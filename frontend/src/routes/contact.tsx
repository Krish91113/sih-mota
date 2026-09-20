import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/mota/PublicLayout";
import { PageBanner } from "@/components/mota/PageBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { submitEnquiry } from "@/api/public";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact the Scholarship Helpdesk | MoTA" },
      {
        name: "description",
        content:
          "Helpdesk numbers, email and office address for MoTA scholarship and fellowship support, with an online enquiry form.",
      },
      { property: "og:title", content: "Contact | MoTA Scholarship Portal" },
      {
        property: "og:description",
        content: "Reach the Ministry of Tribal Affairs scholarship helpdesk.",
      },
    ],
  }),
  component: Contact,
});

const TOPICS = [
  "Application status",
  "Document or deficiency",
  "Institution verification",
  "Bank or disbursement",
  "Technical issue",
];

function Contact() {
  const [reference, setReference] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  const enquiry = useMutation({ mutationFn: submitEnquiry });

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setTopic("");
    setMessage("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const result = await enquiry.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        topic: topic || undefined,
        message: message.trim(),
      });
      setReference(result.reference);
      reset();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "We could not record your enquiry.");
    }
  };

  return (
    <PublicLayout>
      <PageBanner
        title="Contact the scholarship helpdesk"
        desc="Write to us with your application number for a faster response."
        crumb="Contact"
      />
      <div className="shell grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_22rem]">
        <Card className="shadow-card">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-xl">Send an enquiry</h2>
            {reference ? (
              <div className="mt-6 rounded-xl border border-leaf/30 bg-leaf/10 p-5">
                <p className="font-medium text-leaf">Enquiry recorded</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your reference number is{" "}
                  <span className="font-mono font-medium">{reference}</span>. The helpdesk will
                  respond by email.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setReference(null)}
                >
                  Send another enquiry
                </Button>
              </div>
            ) : (
              <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2"
                    placeholder="As per your certificate"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Mobile number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <Label htmlFor="topic">Topic</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger id="topic" className="mt-2 w-full">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPICS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="msg">Message</Label>
                  <Textarea
                    id="msg"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-2"
                    placeholder="Include your application number, scheme name and the issue you are facing."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={enquiry.isPending}>
                    {enquiry.isPending ? "Submitting…" : "Submit enquiry"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-4">
          {[
            {
              icon: Phone,
              title: "Helpdesk",
              lines: ["1800 XXX XXXX (toll free)", "011 2338 XXXX"],
            },
            { icon: Mail, title: "Email", lines: ["helpdesk-scholarship@mota.gov.in"] },
            {
              icon: MapPin,
              title: "Office",
              lines: ["Ministry of Tribal Affairs", "Shastri Bhawan, New Delhi 110001"],
            },
            {
              icon: Clock,
              title: "Working hours",
              lines: ["Monday to Friday", "9:30 am – 6:00 pm"],
            },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border bg-card p-5 shadow-card">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <c.icon className="size-4 text-primary" aria-hidden /> {c.title}
              </p>
              {c.lines.map((l) => (
                <p key={l} className="mt-1.5 text-sm text-muted-foreground">
                  {l}
                </p>
              ))}
            </div>
          ))}
        </aside>
      </div>
    </PublicLayout>
  );
}
