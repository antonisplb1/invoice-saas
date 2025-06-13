from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    company_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    company_name: str
    email: EmailStr

    class Config:
        orm_mode = True
