import { Role } from "./role_model";

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role
}