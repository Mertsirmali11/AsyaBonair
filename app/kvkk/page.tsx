import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata = {
  title: "Privacy notice (KVKK) | bonJour",
  description:
    "Personal data processing information for employees and registration applicants (Turkish KVKK).",
}

export default function KvkkPage() {
  const contactEmail =
    process.env.NEXT_PUBLIC_KVKK_CONTACT_EMAIL?.trim() || "hr@bonjour.com"

  return (
    <div className="min-h-svh bg-gradient-to-b from-muted/60 via-background to-background px-4 py-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/register">← Back to registration</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <Card className="border-border/80 shadow-md">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-2xl leading-snug">
              Privacy notice — personal data processing (KVKK)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Official English text for applicants and employees of bonJour. Last
              updated for worker self-registration.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-8 text-sm leading-relaxed text-foreground/90">
            <p className="font-semibold text-foreground">
              <strong>Data controller:</strong> bonJour
            </p>

            <Separator className="my-6" />

            <h2 className="text-base font-semibold tracking-tight text-foreground">
              1. Purposes of processing and categories of personal data
            </h2>
            <p>
              In connection with your employment or engagement as a worker within bonJour, the
              personal data below are processed for the purposes stated:
            </p>
            <ul className="list-disc space-y-3 pl-5">
              <li>
                <strong>Identity, contact and family information:</strong> First name, surname,
                national ID (T.C.) number, date of birth, mother&apos;s/father&apos;s name, marital
                status, number of children, phone number, address, e-mail, education level,
                emergency contact name and phone number. These data are processed to maintain the
                personnel file required under the employment relationship, fulfil statutory
                notifications, and run human resources processes.
              </li>
              <li>
                <strong>Financial data:</strong> Bank name, IBAN. These data are processed to pay
                salary, bonuses and other benefits.
              </li>
              <li>
                <strong>Special categories of personal data:</strong> Blood type. This is
                processed only for occupational health and safety purposes in situations that may
                require emergency medical intervention.
              </li>
              <li>
                <strong>Security and employment-related data:</strong> System access logs, hazard
                reports you create, incoming/outgoing correspondence records, department, social
                security (SGK) registration number, hire and termination dates. These data are
                processed to secure internal systems, monitor performance and workflows, and support
                compliance with aviation and workplace safety regulations.
              </li>
            </ul>

            <h2 className="pt-6 text-base font-semibold tracking-tight text-foreground">
              2. How data are collected and legal basis
            </h2>
            <p>
              Your personal data are collected through forms and documents you complete or provide
              during recruitment and onboarding, and electronically—automatically (for example when
              you submit a hazard report) or by partly automated means—when you use our systems.
            </p>
            <p>Processing is based on Article 5 of Law No. 6698 (KVKK), including where applicable:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Processing <strong>explicitly provided for by law</strong> and{" "}
                <strong>necessary for compliance with a legal obligation</strong> of the data
                controller (e.g. SGK, tax and labour law obligations);
              </li>
              <li>
                Processing <strong>necessary for the performance or conclusion of a contract</strong>{" "}
                (employment contract);
              </li>
              <li>
                Processing <strong>necessary for the legitimate interests of the data controller</strong>,
                where not overridden by your interests or fundamental rights.
              </li>
            </ul>
            <p>
              Blood type, as special category data, is processed under Article 6 of the Law on the
              basis of <strong>your explicit consent</strong>, or where another statutory exception
              applies in the field of occupational health and safety.
            </p>

            <h2 className="pt-6 text-base font-semibold tracking-tight text-foreground">
              3. Transfers of personal data
            </h2>
            <p>
              Your personal data may be disclosed to public authorities where required by law,
              including but not limited to the Social Security Institution (SGK), the Directorate
              General of Civil Aviation (SHGM), tax offices, law enforcement and competent courts.
              They may also be shared with banks for payroll and with technical service providers
              supporting our IT infrastructure (e.g. hosting or cloud services).
            </p>

            <h2 className="pt-6 text-base font-semibold tracking-tight text-foreground">
              4. Rights of data subjects
            </h2>
            <p>
              Under Article 11 KVKK, you have the right to learn whether your personal data are
              processed, to request information if they are, to learn the purposes of processing and
              whether use is consistent with those purposes, to request rectification if data are
              incomplete or inaccurate, and to request erasure where conditions are met.
            </p>
            <p>
              To exercise these rights, you may contact the Human Resources department in writing or
              via{" "}
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
