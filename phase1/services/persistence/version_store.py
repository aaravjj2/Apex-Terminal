"""
Version Store - Persistent, immutable version storage for strategies and indicators.
Stores versions in SQLite with content hashing for integrity.
"""
import hashlib
import json
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

Base = declarative_base()


class StrategyVersion(Base):
    """Immutable version record for a strategy."""
    __tablename__ = 'strategy_versions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_id = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)  # JSON-serialized strategy config + code
    content_hash = Column(String(64), nullable=False)  # SHA-256
    message = Column(String(500), nullable=True)  # Commit message
    author = Column(String(100), default='system')
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Composite unique constraint
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class VersionStore:
    """
    Manages strategy versioning with immutable history.
    Every save creates a new version. Rollback creates a new version from old content.
    """
    
    def __init__(self, db_url: str = "sqlite:///phase1.db"):
        self.engine = create_engine(db_url)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def _compute_hash(self, content: str) -> str:
        """Compute SHA-256 hash of content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def create_version(
        self, 
        strategy_id: str, 
        content: dict, 
        message: str = None,
        author: str = 'system'
    ) -> dict:
        """
        Create a new version for a strategy.
        Returns the version record.
        """
        session = self.Session()
        try:
            # Get next version number
            max_version = session.query(StrategyVersion).filter_by(
                strategy_id=strategy_id
            ).order_by(StrategyVersion.version.desc()).first()
            
            next_version = (max_version.version + 1) if max_version else 1
            
            content_json = json.dumps(content, sort_keys=True, indent=2)
            content_hash = self._compute_hash(content_json)
            
            # Check if content is unchanged from last version
            if max_version and max_version.content_hash == content_hash:
                return self._version_to_dict(max_version)
            
            version = StrategyVersion(
                strategy_id=strategy_id,
                version=next_version,
                content=content_json,
                content_hash=content_hash,
                message=message or f"Version {next_version}",
                author=author
            )
            session.add(version)
            session.commit()
            return self._version_to_dict(version)
        finally:
            session.close()
    
    def list_versions(self, strategy_id: str, limit: int = 50) -> list:
        """List all versions for a strategy, newest first."""
        session = self.Session()
        try:
            versions = session.query(StrategyVersion).filter_by(
                strategy_id=strategy_id
            ).order_by(StrategyVersion.version.desc()).limit(limit).all()
            return [self._version_to_dict(v) for v in versions]
        finally:
            session.close()
    
    def get_version(self, strategy_id: str, version: int) -> Optional[dict]:
        """Get a specific version."""
        session = self.Session()
        try:
            v = session.query(StrategyVersion).filter_by(
                strategy_id=strategy_id,
                version=version
            ).first()
            return self._version_to_dict(v) if v else None
        finally:
            session.close()
    
    def get_latest_version(self, strategy_id: str) -> Optional[dict]:
        """Get the latest version for a strategy."""
        session = self.Session()
        try:
            v = session.query(StrategyVersion).filter_by(
                strategy_id=strategy_id
            ).order_by(StrategyVersion.version.desc()).first()
            return self._version_to_dict(v) if v else None
        finally:
            session.close()
    
    def diff_versions(self, strategy_id: str, v1: int, v2: int) -> dict:
        """
        Compute diff between two versions.
        Returns a simplified diff structure.
        """
        version1 = self.get_version(strategy_id, v1)
        version2 = self.get_version(strategy_id, v2)
        
        if not version1 or not version2:
            return {"error": "One or both versions not found"}
        
        content1 = json.loads(version1['content'])
        content2 = json.loads(version2['content'])
        
        # Simple key-level diff
        all_keys = set(content1.keys()) | set(content2.keys())
        changes = []
        
        for key in all_keys:
            val1 = content1.get(key)
            val2 = content2.get(key)
            
            if key not in content1:
                changes.append({"type": "added", "key": key, "value": val2})
            elif key not in content2:
                changes.append({"type": "removed", "key": key, "value": val1})
            elif val1 != val2:
                changes.append({"type": "changed", "key": key, "old": val1, "new": val2})
        
        return {
            "strategy_id": strategy_id,
            "from_version": v1,
            "to_version": v2,
            "changes": changes
        }
    
    def rollback(self, strategy_id: str, to_version: int, author: str = 'system') -> dict:
        """
        Rollback to a previous version by creating a new version with old content.
        This preserves immutability - we never delete history.
        """
        old_version = self.get_version(strategy_id, to_version)
        if not old_version:
            return {"error": f"Version {to_version} not found"}
        
        content = json.loads(old_version['content'])
        return self.create_version(
            strategy_id=strategy_id,
            content=content,
            message=f"Rollback to version {to_version}",
            author=author
        )
    
    def _version_to_dict(self, v: StrategyVersion) -> dict:
        """Convert SQLAlchemy model to dict."""
        return {
            "id": v.id,
            "strategy_id": v.strategy_id,
            "version": v.version,
            "content": v.content,
            "content_hash": v.content_hash,
            "message": v.message,
            "author": v.author,
            "created_at": v.created_at.isoformat() if v.created_at else None
        }


# Singleton instance
_version_store: Optional[VersionStore] = None

def get_version_store() -> VersionStore:
    """Get or create the version store singleton."""
    global _version_store
    if _version_store is None:
        _version_store = VersionStore()
    return _version_store
