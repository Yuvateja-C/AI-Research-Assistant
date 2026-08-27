import sys
import requests
import secrets
import json

BASE_URL = "http://127.0.0.1:8000"

def main():
    print("[TEST] Starting Live End-to-End System Verification against", BASE_URL)
    session = requests.Session()

    # 1. Health & Readiness
    print("\n--- Phase 3: Health & Readiness Check ---")
    r = session.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("PASS: /health returned status 200 ->", r.json()["status"])

    r_ready = session.get(f"{BASE_URL}/health/ready")
    assert r_ready.status_code == 200, f"Readiness check failed: {r_ready.text}"
    print("PASS: /health/ready returned status 200 ->", r_ready.json())

    # 2. Registration Flow
    print("\n--- Phase 4: Live Authentication & Session Verification ---")
    u_name = f"live_tester_{secrets.token_hex(4)}"
    u_email = f"{u_name}@example.com"
    u_pass = "SecurePass123!"

    reg_resp = session.post(
        f"{BASE_URL}/auth/register",
        json={"username": u_name, "email": u_email, "password": u_pass}
    )
    assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert "user_id" in reg_data, "user_id missing in register response"
    print("PASS: Registered user successfully ->", reg_data["user_id"])

    # Login Directly (No email verification requirement)
    login_resp = session.post(
        f"{BASE_URL}/auth/login",
        json={"username_or_email": u_email, "password": u_pass}
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    assert "token" in login_data, "token missing in login response"
    assert "user" in login_data, "user dictionary missing in login response"
    assert login_data["user"]["email"] == u_email, "user email mismatch in payload"
    token = login_data["token"]
    print("PASS: Login returned token and user dictionary ->", login_data["user"]["username"])

    auth_headers = {"Authorization": f"Bearer {token}"}

    # Session validation (/auth/me)
    me_resp = session.get(f"{BASE_URL}/auth/me", headers=auth_headers)
    assert me_resp.status_code == 200, f"/auth/me failed: {me_resp.text}"
    assert me_resp.json()["authenticated"] is True, "Not authenticated according to /auth/me"
    print("PASS: /auth/me validated session ->", me_resp.json()["user"]["email"])

    # 3. Workspace / Chat Creation
    print("\n--- Phase 5 & 6: Real Workspace & RAG Query Workflow ---")
    chat_resp = session.post(f"{BASE_URL}/chats", headers=auth_headers)
    assert chat_resp.status_code == 200, f"Create chat failed: {chat_resp.text}"
    chat_id = chat_resp.json()["id"]
    print("PASS: Created research workspace ->", chat_id)

    # 4. Document Upload Workflow
    print("\n--- Phase 7: Document Upload & Indexing ---")
    doc_payload = (
        "ResearchAI Architecture Document\n\n"
        "Abstract: ResearchAI utilizes high-performance semantic retrieval models, "
        "providing real-time contextual evidence synthesis across research corpora.\n"
        "Results: Accuracy improved by 45% compared to keyword baseline indexing."
    ).encode("utf-8")

    upl_resp = session.post(
        f"{BASE_URL}/upload?filename=whitepaper_research.txt&chat_id={chat_id}",
        data=doc_payload,
        headers=auth_headers
    )
    assert upl_resp.status_code == 200, f"Upload failed: {upl_resp.text}"
    upl_data = upl_resp.json()
    assert upl_data["total_chunks"] >= 1, "Expected text chunks indexed"
    print(f"PASS: Uploaded and indexed {upl_data['filename']} ({upl_data['total_chunks']} chunks).")

    # Invalid file rejection
    inv_resp = session.post(
        f"{BASE_URL}/upload?filename=payload.exe&chat_id={chat_id}",
        data=b"binary exe content",
        headers=auth_headers
    )
    assert inv_resp.status_code == 400, "Invalid file was not rejected with 400"
    print("PASS: Invalid file extension (.exe) rejected with HTTP 400.")

    # Oversized file rejection
    oversized_data = b"0" * (51 * 1024 * 1024)
    big_resp = session.post(
        f"{BASE_URL}/upload?filename=huge.txt&chat_id={chat_id}",
        data=oversized_data,
        headers=auth_headers
    )
    assert big_resp.status_code == 400, "Oversized file was not rejected with 400"
    print("PASS: Oversized file (>50MB) rejected with HTTP 400.")

    # 5. Query / Ask endpoint
    ask_resp = session.post(
        f"{BASE_URL}/chats/{chat_id}/ask",
        json={
            "question": "What is the accuracy improvement reported in the whitepaper?",
            "persona": "researcher"
        },
        headers=auth_headers,
        stream=True
    )
    assert ask_resp.status_code == 200, f"Query endpoint failed: {ask_resp.text}"
    raw_stream = ""
    for chunk in ask_resp.iter_content(chunk_size=512):
        if chunk:
            raw_stream += chunk.decode("utf-8", errors="ignore")
    assert "data: " in raw_stream, "SSE stream format missing"
    print("PASS: Streaming query response received ->", raw_stream[:120].replace("\n", " "))

    # 6. Report Generation
    rep_resp = session.post(
        f"{BASE_URL}/reports",
        json={"chat_id": chat_id},
        headers=auth_headers
    )
    assert rep_resp.status_code == 200, f"Report generation failed: {rep_resp.text}"
    rep_data = rep_resp.json()
    assert "executive_summary" in rep_data, "executive_summary missing from report"
    print("PASS: Compiled structured research report -> ID:", rep_data["id"])

    # 7. Logout & Token Invalidation
    print("\n--- Phase 4 (Part 2): Logout & Session Invalidation ---")
    logout_resp = session.post(f"{BASE_URL}/auth/logout", headers=auth_headers)
    assert logout_resp.status_code == 200, f"Logout failed: {logout_resp.text}"
    print("PASS: /auth/logout completed successfully.")

    # Confirm token is invalidated
    post_logout_resp = session.get(f"{BASE_URL}/auth/me", headers=auth_headers)
    assert post_logout_resp.status_code == 401, f"Expected 401 after logout, got {post_logout_resp.status_code}"
    print("PASS: Protected endpoint rejected invalidated token with HTTP 401.")

    # 8. Invalid Credentials Test
    bad_login = session.post(
        f"{BASE_URL}/auth/login",
        json={"username_or_email": u_email, "password": "WrongPassword123"}
    )
    assert bad_login.status_code == 401, f"Expected 401 for wrong credentials, got {bad_login.status_code}"
    print("PASS: Invalid credentials rejected with HTTP 401.")

    print("\n=======================================================")
    print("ALL LIVE END-TO-END VERIFICATION CHECKS PASSED (100%)!")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
