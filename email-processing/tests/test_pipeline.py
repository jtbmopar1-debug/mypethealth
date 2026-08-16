from __future__ import annotations

import mailbox
import sys
import tempfile
import unittest
from email.message import EmailMessage
from pathlib import Path


PROCESSING_ROOT = Path(__file__).resolve().parents[1]
if str(PROCESSING_ROOT) not in sys.path:
    sys.path.insert(0, str(PROCESSING_ROOT))

from pipeline.classifier import classify_sender  # noqa: E402
from pipeline.extract import consolidate, similarity  # noqa: E402
from pipeline.privacy import audit_text, sanitise_text  # noqa: E402
from pipeline.runner import iter_mbox_stream  # noqa: E402
from pipeline.schema import validate_knowledge_entry  # noqa: E402
from pipeline.text import clean_body, extract_body, html_to_text, remove_quoted_reply, remove_signature  # noqa: E402


class ParsingTests(unittest.TestCase):
    def test_email_parsing_prefers_plain_text_and_skips_attachments(self) -> None:
        message = EmailMessage()
        message.set_content("Useful customer question")
        message.add_alternative("<p>HTML fallback</p>", subtype="html")
        message.add_attachment(b"private attachment", maintype="application", subtype="octet-stream", filename="file.bin")
        self.assertEqual(extract_body(message), "Useful customer question")

    def test_html_to_text_removes_scripts_and_preserves_blocks(self) -> None:
        result = html_to_text("<style>secret{}</style><p>Hello <b>there</b></p><script>bad()</script><p>Next</p>")
        self.assertNotIn("secret", result)
        self.assertNotIn("bad", result)
        self.assertIn("Hello there", result)
        self.assertIn("Next", result)

    def test_quoted_reply_removal(self) -> None:
        value = "Current reply\n\nOn Monday, Someone wrote:\n> old private message"
        self.assertEqual(remove_quoted_reply(value), "Current reply")

    def test_signature_removal(self) -> None:
        value = "The useful guidance.\n\nKind regards\nA Staff Person\n09 000 0000"
        self.assertEqual(remove_signature(value), "The useful guidance.")


class PrivacyTests(unittest.TestCase):
    def test_email_address_removal(self) -> None:
        clean, found = sanitise_text("Contact person@example.com for details")
        self.assertNotIn("person@example.com", clean)
        self.assertIn("email_address", found)
        self.assertFalse(audit_text(clean))

    def test_phone_number_removal(self) -> None:
        clean, found = sanitise_text("Call 021 123 4567 tomorrow")
        self.assertNotIn("021 123 4567", clean)
        self.assertIn("phone_number", found)
        self.assertFalse(audit_text(clean))

    def test_name_and_address_removal(self) -> None:
        clean, found = sanitise_text("Hi Sarah, my dog is called Charlie. Deliver to 12 Sample Road")
        self.assertNotIn("Sarah", clean)
        self.assertNotIn("Charlie", clean)
        self.assertNotIn("12 Sample Road", clean)
        self.assertIn("person_name", found)
        self.assertIn("postal_address", found)


class ClassificationAndKnowledgeTests(unittest.TestCase):
    CONFIG = {"business_domains": ["allgoodpetfood.co.nz"], "business_addresses": []}

    def test_business_vs_customer_classification(self) -> None:
        self.assertEqual(classify_sender("Team <help@allgoodpetfood.co.nz>", self.CONFIG), "business")
        self.assertEqual(classify_sender("Customer <person@example.net>", self.CONFIG), "customer")

    def test_duplicate_detection_and_consolidation(self) -> None:
        first = self._entry("The customer's dog is itchy on chicken food.")
        second = self._entry("The customer's dog is itchy on a chicken food.")
        self.assertGreater(similarity(first, second), 0.72)
        merged = consolidate([first, second], 0.72)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["source_count"], 2)

    def test_final_knowledge_schema_validation(self) -> None:
        self.assertEqual(validate_knowledge_entry(self._entry("A useful customer question.")), [])
        invalid = self._entry("")
        self.assertIn("empty:customer_question", validate_knowledge_entry(invalid))

    def test_synthetic_mbox_can_be_read_without_modification(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "synthetic.mbox"
            box = mailbox.mbox(path)
            message = mailbox.mboxMessage()
            message["From"] = "customer@example.net"
            message["Subject"] = "Food question"
            message.set_payload("My dog has a sensitive stomach and needs food guidance.")
            box.add(message)
            box.flush()
            box.close()
            before = path.read_bytes()
            reader = mailbox.mbox(path, create=False)
            parsed = list(reader)
            reader.close()
            self.assertEqual(len(parsed), 1)
            self.assertEqual(before, path.read_bytes())

    def test_streaming_reader_resumes_from_byte_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "streaming.mbox"
            box = mailbox.mbox(path)
            for number in range(3):
                message = mailbox.mboxMessage()
                message["From"] = "customer@example.net"
                message["Subject"] = f"Question {number}"
                message.set_payload(f"Synthetic body {number}")
                box.add(message)
            box.flush()
            box.close()
            before = path.read_bytes()
            iterator = iter(iter_mbox_stream(path))
            first_index, first_message, checkpoint = next(iterator)
            iterator.close()
            resumed = list(iter_mbox_stream(path, checkpoint, first_index + 1))
            self.assertEqual(first_message["Subject"], "Question 0")
            self.assertEqual([message["Subject"] for _, message, _ in resumed], ["Question 1", "Question 2"])
            self.assertEqual(before, path.read_bytes())

    @staticmethod
    def _entry(question: str) -> dict[str, object]:
        return {
            "id": "candidate_test",
            "category": "skin_and_itching",
            "customer_question": question,
            "situation": question,
            "useful_context": ["Current food and main protein"],
            "follow_up_questions": ["What protein is currently fed?"],
            "all_good_guidance": "The historical reply recommends a carefully managed alternative-protein trial.",
            "reasoning": "The reply recommends this because the current recipe contains chicken.",
            "relevant_product_names": [],
            "safety_notes": "",
            "tags": ["itching", "protein"],
            "source_count": 1,
            "confidence": "high",
        }


if __name__ == "__main__":
    unittest.main()
