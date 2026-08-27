"""
SQLAlchemy ORM Reference Schema Definitions for ResearchAI Backend.
Note: Runtime query execution in `database.py` utilizes raw SQL with 
lightweight adapter wrappers (`CursorWrapper`, `ConnectionWrapper`) to support
both SQLite and PostgreSQL dynamically without heavy ORM overhead.
"""

from sqlalchemy import Column, String, Integer, BigInteger, Float, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)
    role = Column(String, default='user')
    secret_2fa = Column(String, nullable=True)
    is_2fa_enabled = Column(Integer, default=0)
    created_at = Column(BigInteger, nullable=False)
    name = Column(String, nullable=True)
    status = Column(String, default='active')
    is_verified = Column(Integer, default=0)
    verification_token = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(BigInteger, nullable=True)

    # Relationships
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")


class Chat(Base):
    __tablename__ = 'chats'

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = Column(String, nullable=False)
    file_info = Column(Text, nullable=True) # JSON String
    summary = Column(Text, nullable=True)
    status = Column(String, default='active') # active, archived, favorite
    tags = Column(String, default='')
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

    # Relationships
    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = 'messages'

    id = Column(String, primary_key=True)
    chat_id = Column(String, ForeignKey('chats.id', ondelete='CASCADE'), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True) # JSON String
    created_at = Column(BigInteger, nullable=False)

    # Relationships
    chat = relationship("Chat", back_populates="messages")


class Session(Base):
    __tablename__ = 'sessions'

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(BigInteger, nullable=False)

    # Relationships
    user = relationship("User", back_populates="sessions")


class Report(Base):
    __tablename__ = 'reports'

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = Column(String, nullable=False)
    chat_id = Column(String, nullable=True)
    executive_summary = Column(Text, nullable=True)
    research_overview = Column(Text, nullable=True)
    detailed_analysis = Column(Text, nullable=True)
    key_findings = Column(Text, nullable=True)
    ai_insights = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    confidence_score = Column(Float, default=0.95)
    is_favorite = Column(Integer, default=0)
    is_deleted = Column(Integer, default=0)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

    # Relationships
    user = relationship("User", back_populates="reports")
