import os
import sys
import unittest
import secrets
from fastapi.testclient import TestClient

# Ensure Backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["ALLOW_HASH_EMBEDDINGS"] = "true"

from main import app
from database import init_db

class TestPhase7E2ESecurityStress(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        init_db()

    def setUp(self):
        from main import RATE_LIMIT_STORE
        RATE_LIMIT_STORE.clear()
        init_db()

    def test_complete_user_journey_flow(self):
        """E2E Journey: Register -> Login -> Create Chat -> Upload Doc -> Ask Question -> Generate Report -> Delete Chat."""
        u_name = f"e2e_user_{secrets.token_hex(4)}"
        u_email = f"{u_name}@example.com"
        u_pass = "Password123"

        # 1. Register
        r_resp = self.client.post("/auth/register", json={"email": u_email, "username": u_name, "password": u_pass})
        self.assertEqual(r_resp.status_code, 200)

        # 2. Login Directly
        l_resp = self.client.post("/auth/login", json={"username_or_email": u_email, "password": u_pass})
        self.assertEqual(l_resp.status_code, 200)
        token = l_resp.json()["token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Chat
        chat_resp = self.client.post("/chats", headers=auth_headers)
        self.assertEqual(chat_resp.status_code, 200)
        chat_id = chat_resp.json()["id"]

        # 4. Upload Document Context
        doc_content = b"ResearchAI Platform Architecture uses FastAPI, ChromaDB, and Groq fallback models."
        upl_resp = self.client.post(
            f"/upload?filename=architecture_spec.txt&chat_id={chat_id}",
            content=doc_content,
            headers=auth_headers
        )
        self.assertEqual(upl_resp.status_code, 200)
        self.assertIn("processed", upl_resp.json()["status"])

        # 5. Ask Question
        ask_resp = self.client.post(
            f"/chats/{chat_id}/ask",
            json={"question": "What backend framework does ResearchAI platform use?", "persona": "default"},
            headers=auth_headers
        )
        self.assertEqual(ask_resp.status_code, 200)

        # 6. Generate Research Report
        rep_resp = self.client.post("/reports", json={"chat_id": chat_id}, headers=auth_headers)
        self.assertEqual(rep_resp.status_code, 200)
        self.assertIn("executive_summary", rep_resp.json())

        # 7. Delete Chat Session (Cascading Clean)
        del_resp = self.client.delete(f"/chats/{chat_id}", headers=auth_headers)
        self.assertEqual(del_resp.status_code, 200)

    def test_cross_user_isolation_and_idor_protection(self):
        """Verify IDOR prevention across chats, messages, and reports between User A and User B."""
        # Setup User A
        ua_name = f"user_a_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{ua_name}@ex.com", "username": ua_name, "password": "Password123"})
        token_a = self.client.post("/auth/login", json={"username_or_email": ua_name, "password": "Password123"}).json()["token"]

        # Setup User B
        ub_name = f"user_b_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{ub_name}@ex.com", "username": ub_name, "password": "Password123"})
        token_b = self.client.post("/auth/login", json={"username_or_email": ub_name, "password": "Password123"}).json()["token"]

        # User A creates chat
        chat_a = self.client.post("/chats", headers={"Authorization": f"Bearer {token_a}"}).json()["id"]

        # User B attempts access to User A's chat (Should return 404)
        get_b_resp = self.client.get(f"/chats/{chat_a}/messages", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(get_b_resp.status_code, 404)

        # User B attempts deletion of User A's chat (Should return 404)
        del_b_resp = self.client.delete(f"/chats/{chat_a}", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(del_b_resp.status_code, 404)

    def test_unauthenticated_request_rejection(self):
        """Verify protected endpoints reject requests without token with 401 Unauthorized."""
        self.assertEqual(self.client.get("/chats").status_code, 401)
        self.assertEqual(self.client.get("/reports").status_code, 401)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_sanitization_against_path_traversal_filenames(self):
        """Verify uploaded filenames containing path traversal payloads are sanitized safely."""
        u_name = f"user_path_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{u_name}@ex.com", "username": u_name, "password": "Password123"})
        token = self.client.post("/auth/login", json={"username_or_email": u_name, "password": "Password123"}).json()["token"]
        chat_id = self.client.post("/chats", headers={"Authorization": f"Bearer {token}"}).json()["id"]

        # Attempt uploading with path traversal filename
        resp = self.client.post(
            f"/upload?filename=../../../../etc/passwd.txt&chat_id={chat_id}",
            content=b"sample text context",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("..", resp.json()["filename"])

if __name__ == "__main__":
    unittest.main()
