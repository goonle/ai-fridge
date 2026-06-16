from app.models.database import Base, engine
from app.models.items import Item

Base.metadata.create_all(bind=engine)
exit()