"""Optional Neo4j graph for public social relationships (never account credentials)."""
from app.core.config import settings


class GraphUnavailable(RuntimeError):
    pass


class SocialGraph:
    def __init__(self):
        self._driver = None
        if settings.neo4j_enabled:
            try:
                from neo4j import GraphDatabase
                self._driver = GraphDatabase.driver(
                    settings.neo4j_uri,
                    auth=(settings.neo4j_user, settings.neo4j_password),
                )
            except Exception:
                self._driver = None

    @property
    def enabled(self) -> bool:
        return self._driver is not None

    def ensure_user(self, user_id: str, username: str, display_name: str) -> None:
        if not self.enabled:
            raise GraphUnavailable("Neo4j is not enabled or reachable")
        with self._driver.session() as session:
            session.run(
                "MERGE (u:User {id: $id}) SET u.username=$username, u.display_name=$display_name",
                id=user_id, username=username, display_name=display_name,
            ).consume()

    def follow(self, follower_id: str, follower_name: str, target_id: str, target_name: str) -> None:
        if not self.enabled:
            raise GraphUnavailable("Neo4j is not enabled or reachable")
        with self._driver.session() as session:
            session.run(
                "MERGE (a:User {id:$a}) SET a.username=$an "
                "MERGE (b:User {id:$b}) SET b.username=$bn "
                "MERGE (a)-[:FOLLOWS]->(b)",
                a=follower_id, an=follower_name, b=target_id, bn=target_name,
            ).consume()

    def are_mutual_friends(self, first_id: str, second_id: str) -> bool:
        if not self.enabled:
            raise GraphUnavailable("Neo4j is not enabled or reachable")
        with self._driver.session() as session:
            record = session.run(
                "MATCH (a:User {id:$a})-[:FOLLOWS]->(b:User {id:$b}) "
                "MATCH (b)-[:FOLLOWS]->(a) RETURN count(*) > 0 AS mutual",
                a=first_id, b=second_id,
            ).single()
            return bool(record and record["mutual"])

    def friends(self, user_id: str) -> list[dict]:
        if not self.enabled:
            raise GraphUnavailable("Neo4j is not enabled or reachable")
        with self._driver.session() as session:
            result = session.run(
                "MATCH (:User {id:$id})-[:FOLLOWS]->(other:User) "
                "MATCH (other)-[:FOLLOWS]->(:User {id:$id}) "
                "RETURN other.id AS id, other.username AS username, other.display_name AS display_name "
                "ORDER BY other.username LIMIT 500", id=user_id,
            )
            return [dict(record) for record in result]

    def following(self, user_id: str) -> list[dict]:
        if not self.enabled:
            raise GraphUnavailable("Neo4j is not enabled or reachable")
        with self._driver.session() as session:
            result = session.run(
                "MATCH (:User {id:$id})-[:FOLLOWS]->(other:User) "
                "RETURN other.id AS id, other.username AS username, other.display_name AS display_name "
                "ORDER BY other.username LIMIT 500", id=user_id,
            )
            return [dict(record) for record in result]

    def close(self) -> None:
        if self._driver:
            self._driver.close()


graph = SocialGraph()
