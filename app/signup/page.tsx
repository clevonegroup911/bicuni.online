import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Inscription" };
export default function SignupPage() { return <RegisterForm/>; }
