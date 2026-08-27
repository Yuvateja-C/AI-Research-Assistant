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

class TestProductionReadiness(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        init_db()

    def setUp(self):
        from main import RATE_LIMIT_STORE
        RATE_LIMIT_STORE.clear()
        init_db()

    def test_health_check(self):
        """Verify liveness health check endpoint."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("timestamp", data)

    def test_health_readiness(self):
        """Verify readiness check endpoint for DB and ChromaDB health."""
        response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["database"], "healthy")
        self.assertEqual(data["vector_store"], "healthy")
        self.assertIn("embedding_engine", data)

    def test_auth_registration_login_flow(self):
        """Verify direct user registration, immediate login, and session check without SMTP verification dependencies."""
        test_user = f"user_{secrets.token_hex(4)}"
        test_email = f"{test_user}@example.com"
        test_pass = "Password123"

        # 1. Register User
        reg_resp = self.client.post(
            "/auth/register",
            json={"email": test_email, "username": test_user, "password": test_pass}
        )
        self.assertEqual(reg_resp.status_code, 200)
        self.assertIn("user_id", reg_resp.json())

        # 2. Login Directly
        login_resp = self.client.post(
            "/auth/login",
            json={"username_or_email": test_email, "password": test_pass}
        )
        self.assertEqual(login_resp.status_code, 200)
        data = login_resp.json()
        self.assertIn("token", data)
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], test_email)
        token = data["token"]

        # 3. Check /auth/me with session token header
        me_resp = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        me_data = me_resp.json()
        self.assertTrue(me_data["authenticated"])
        self.assertEqual(me_data["user"]["email"], test_email)

    def test_user_resource_isolation(self):
        """Verify strict authorization isolation between distinct user accounts."""
        # User 1 Setup
        u1_name = f"user1_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{u1_name}@ex.com", "username": u1_name, "password": "Password123"})
        t1 = self.client.post("/auth/login", json={"username_or_email": u1_name, "password": "Password123"}).json()["token"]

        # User 2 Setup
        u2_name = f"user2_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{u2_name}@ex.com", "username": u2_name, "password": "Password123"})
        t2 = self.client.post("/auth/login", json={"username_or_email": u2_name, "password": "Password123"}).json()["token"]

        # User 1 creates a chat
        chat1_resp = self.client.post("/chats", headers={"Authorization": f"Bearer {t1}"})
        self.assertEqual(chat1_resp.status_code, 200)
        c1_id = chat1_resp.json()["id"]

        # User 2 attempts to fetch User 1's chat messages (Should be Rejected)
        forbidden_resp = self.client.get(f"/chats/{c1_id}/messages", headers={"Authorization": f"Bearer {t2}"})
        self.assertIn(forbidden_resp.status_code, [403, 404])

    def test_invalid_file_upload_rejection(self):
        """Verify that uploaded files with unsupported extensions are rejected with 400 Bad Request."""
        u_name = f"user_upl_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{u_name}@ex.com", "username": u_name, "password": "Password123"})
        token = self.client.post("/auth/login", json={"username_or_email": u_name, "password": "Password123"}).json()["token"]

        c_id = self.client.post("/chats", headers={"Authorization": f"Bearer {token}"}).json()["id"]

        # Attempt to upload malicious/unsupported file extension (.exe)
        resp = self.client.post(
            f"/upload?filename=malicious_payload.exe&chat_id={c_id}",
            content=b"executable content",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Unsupported file type", resp.json()["error"]["message"])

    def test_unrestricted_free_document_uploads(self):
        """Verify that users can upload multiple text documents without tier restrictions."""
        u_name = f"user_free_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{u_name}@ex.com", "username": u_name, "password": "Password123"})
        token = self.client.post("/auth/login", json={"username_or_email": u_name, "password": "Password123"}).json()["token"]

        for i in range(4):
            c_id = self.client.post("/chats", headers={"Authorization": f"Bearer {token}"}).json()["id"]
            resp = self.client.post(
                f"/upload?filename=doc_{i}.txt&chat_id={c_id}",
                content=f"Sample research content data {i}".encode("utf-8"),
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(resp.status_code, 200)

    def test_embedding_generation(self):
        """Verify that embeddings_service generates valid non-empty vector arrays."""
        from embeddings_service import generate_embeddings
        sample_chunks = ["Machine Learning in AI", "Deep Learning with Neural Networks"]
        embeddings = generate_embeddings(sample_chunks)
        self.assertIsInstance(embeddings, list)
        self.assertEqual(len(embeddings), 2)
        self.assertGreater(len(embeddings[0]), 0)

    def test_oversized_file_upload_rejection(self):
        """Verify that files exceeding the 50 MB limit are rejected with 400 Bad Request."""
        u_name = f"user_big_{secrets.token_hex(4)}"
        self.client.post("/auth/register", json={"email": f"{u_name}@ex.com", "username": u_name, "password": "Password123"})
        token = self.client.post("/auth/login", json={"username_or_email": u_name, "password": "Password123"}).json()["token"]
        c_id = self.client.post("/chats", headers={"Authorization": f"Bearer {token}"}).json()["id"]

        # 51 MB payload simulation
        big_content = b"A" * (51 * 1024 * 1024)
        resp = self.client.post(
            f"/upload?filename=huge_file.txt&chat_id={c_id}",
            content=big_content,
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("exceeds maximum allowed limit", resp.json()["error"]["message"])

    def test_rate_limiting(self):
        """Verify that exceeding rate limits returns HTTP 429 Too Many Requests."""
        u_name = f"user_rl_{secrets.token_hex(4)}"
        # Rapidly attempt registration exceeding limit of 10 requests/min
        for i in range(12):
            resp = self.client.post(
                "/auth/register",
                json={"email": f"test_rl_{i}_{secrets.token_hex(2)}@ex.com", "username": f"user_rl_{i}_{secrets.token_hex(2)}", "password": "Password123"}
            )
        self.assertEqual(resp.status_code, 429)

if __name__ == "__main__":
    unittest.main()
