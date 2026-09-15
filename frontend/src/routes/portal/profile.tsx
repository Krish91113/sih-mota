import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUserQuery, useApplicantProfileQuery, useUpdateApplicantProfileMutation } from "@/hooks/api/useAuth";
import type { ReactNode } from "react";
import { Cloud, Download, Landmark, Link2, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/profile")({
  head: () => ({
    meta: [{ title: "My Profile | Applicant Portal" }],
  }),
  component: Profile,
});

function Profile() {
  const userQuery = useCurrentUserQuery();
  const profileQuery = useApplicantProfileQuery();
  const updateMutation = useUpdateApplicantProfileMutation();

  const user = userQuery.data;
  const profileData = profileQuery.data?.profile || {};

  // Form State
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [personal, setPersonal] = useState({
    dob: "1999-03-14",
    gender: "Female",
    marital: "Single",
    nationality: "Indian",
    aadhaar: "XXXXXXXX4821",
  });

  const [contact, setContact] = useState({
    mobile: "9876543210",
    altMobile: "",
    email: user?.email ?? "",
  });

  const [address, setAddress] = useState({
    current: "Village - Gumla, District - Gumla, Jharkhand - 835207",
    permanent: "Village - Gumla, District - Gumla, Jharkhand - 835207",
  });

  const [st, setSt] = useState({
    tribe: "Oraon",
    certificateNo: "JH/ST/2021/88392",
    issuingAuthority: "Sub-Divisional Officer, Gumla",
    dateOfIssue: "2021-06-15",
  });

  const [family, setFamily] = useState({
    fatherName: "Somra Kujur",
    motherName: "Budhni Kujur",
    guardian: "Somra Kujur",
    siblings: "2",
  });

  const [income, setIncome] = useState({
    annual: "₹ 1,80,000",
    source: "Agriculture & Small Trade",
    certificateAvailable: true,
  });

  const [institution, setInstitution] = useState({
    name: "Ranchi University",
    universityReg: "RU/2023/ST-4491",
    state: "Jharkhand",
    district: "Ranchi",
    course: "Ph.D in Tribal Studies",
    admissionYear: "2023",
    durationYears: "3",
  });

  const [bank, setBank] = useState({
    accountNo: "308291048572",
    ifsc: "SBIN0001234",
    bank: "State Bank of India",
    branch: "Main Branch, Ranchi",
    holderName: user?.full_name ?? "Applicant",
  });

  const [academic, setAcademic] = useState<Array<{ level: string; board: string; year: string; marks: string }>>([
    { level: "Class 10 (Secondary)", board: "Jharkhand Academic Council", year: "2015", marks: "84.2%" },
    { level: "Class 12 (Higher Secondary)", board: "Jharkhand Academic Council", year: "2017", marks: "81.6%" },
    { level: "Bachelor's Degree", board: "Ranchi University", year: "2020", marks: "78.4%" },
    { level: "Master's Degree", board: "Ranchi University", year: "2022", marks: "82.0%" },
  ]);

  const [communication, setCommunication] = useState({
    emailNotifs: true,
    smsNotifs: true,
    whatsappNotifs: false,
    language: "English",
  });

  // Sync state when profile loads
  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (user?.email) setContact((prev) => ({ ...prev, email: user.email }));
    if (profileQuery.data) {
      const p = profileQuery.data.profile;
      if (p.personal) setPersonal((prev) => ({ ...prev, ...(p.personal as any) }));
      if (p.contact) setContact((prev) => ({ ...prev, ...(p.contact as any) }));
      if (p.address) setAddress((prev) => ({ ...prev, ...(p.address as any) }));
      if (p.st) setSt((prev) => ({ ...prev, ...(p.st as any) }));
      if (p.family) setFamily((prev) => ({ ...prev, ...(p.family as any) }));
      if (p.income) setIncome((prev) => ({ ...prev, ...(p.income as any) }));
      if (p.institution) setInstitution((prev) => ({ ...prev, ...(p.institution as any) }));
      if (p.bank) setBank((prev) => ({ ...prev, ...(p.bank as any) }));
      if (Array.isArray(p.academic) && p.academic.length > 0) setAcademic(p.academic as any);
      if (p.communication) setCommunication((prev) => ({ ...prev, ...(p.communication as any) }));
    }
  }, [profileQuery.data, user]);

  const save = async () => {
    try {
      await updateMutation.mutateAsync({
        full_name: fullName,
        profile: {
          personal,
          contact,
          address,
          st,
          family,
          income,
          institution,
          bank,
          academic,
          communication,
        },
      });
      toast.success("Profile updated and saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile changes");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "AP";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const addAcademicRow = () => {
    setAcademic([...academic, { level: "Other Qualification", board: "", year: "2024", marks: "" }]);
  };

  const removeAcademicRow = (index: number) => {
    setAcademic(academic.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Card className="mb-6 border-primary/20 bg-accent/40 shadow-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-sm">
              {getInitials(fullName || user?.full_name || "Applicant")}
            </span>
            <div>
              <p className="text-lg font-semibold">{fullName || user?.full_name || "Applicant"}</p>
              <p className="text-sm text-muted-foreground">
                {st.tribe ? `${st.tribe} Tribe` : "Scheduled Tribe"} · {institution.name || "Higher Education"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge variant="secondary">Profile complete 95%</Badge>
                <Badge variant="outline" className="text-leaf border-leaf/30 bg-leaf/5">
                  ✓ Verified ST Beneficiary
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([JSON.stringify({ fullName, personal, contact, address, st, family, income, institution, bank, academic }, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `mota_profile_${fullName.replace(/\s+/g, "_")}.json`;
                a.click();
              }}
            >
              <Download className="size-4" aria-hidden /> Export Profile
            </Button>
            <Button size="sm" onClick={save} disabled={updateMutation.isPending}>
              <Save className="size-4" aria-hidden /> {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <div className="mb-6 overflow-x-auto pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="contact">Contact & Address</TabsTrigger>
            <TabsTrigger value="st">ST Details</TabsTrigger>
            <TabsTrigger value="family">Family & Income</TabsTrigger>
            <TabsTrigger value="academic">Academic History</TabsTrigger>
            <TabsTrigger value="institution">Institution</TabsTrigger>
            <TabsTrigger value="bank">Bank Account</TabsTrigger>
            <TabsTrigger value="communication">Preferences</TabsTrigger>
          </TabsList>
        </div>

        {/* PERSONAL */}
        <TabsContent value="personal" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Personal Details — Persistent Profile</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor="fullName" className="text-xs text-muted-foreground uppercase">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="dob" className="text-xs text-muted-foreground uppercase">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={personal.dob}
                    onChange={(e) => setPersonal({ ...personal, dob: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="gender" className="text-xs text-muted-foreground uppercase">Gender</Label>
                  <Select
                    value={personal.gender}
                    onValueChange={(v) => setPersonal({ ...personal, gender: v })}
                  >
                    <SelectTrigger id="gender" className="mt-1">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="marital" className="text-xs text-muted-foreground uppercase">Marital Status</Label>
                  <Select
                    value={personal.marital}
                    onValueChange={(v) => setPersonal({ ...personal, marital: v })}
                  >
                    <SelectTrigger id="marital" className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nationality" className="text-xs text-muted-foreground uppercase">Nationality</Label>
                  <Input
                    id="nationality"
                    value={personal.nationality}
                    onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="aadhaar" className="text-xs text-muted-foreground uppercase">Aadhaar (Last 4 digits / Masked)</Label>
                  <Input
                    id="aadhaar"
                    value={personal.aadhaar}
                    onChange={(e) => setPersonal({ ...personal, aadhaar: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Personal details are maintained once and prefilled across every scheme application.
          </p>
        </TabsContent>

        {/* CONTACT & ADDRESS */}
        <TabsContent value="contact" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="email" className="text-xs text-muted-foreground uppercase">Registered Email</Label>
                  <Input id="email" value={contact.email} disabled className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="mobile" className="text-xs text-muted-foreground uppercase">Contact Mobile</Label>
                  <Input
                    id="mobile"
                    value={contact.mobile}
                    onChange={(e) => setContact({ ...contact, mobile: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="altMobile" className="text-xs text-muted-foreground uppercase">Alternate Mobile (Optional)</Label>
                  <Input
                    id="altMobile"
                    value={contact.altMobile}
                    onChange={(e) => setContact({ ...contact, altMobile: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Address Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="currAddr" className="text-xs text-muted-foreground uppercase">Current Communication Address</Label>
                  <Input
                    id="currAddr"
                    value={address.current}
                    onChange={(e) => setAddress({ ...address, current: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="permAddr" className="text-xs text-muted-foreground uppercase">Permanent Domicile Address</Label>
                  <Input
                    id="permAddr"
                    value={address.permanent}
                    onChange={(e) => setAddress({ ...address, permanent: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ST DETAILS */}
        <TabsContent value="st" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Scheduled Tribe Certificate Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="tribe" className="text-xs text-muted-foreground uppercase">Sub-Tribe / Community</Label>
                  <Input
                    id="tribe"
                    value={st.tribe}
                    onChange={(e) => setSt({ ...st, tribe: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="certNo" className="text-xs text-muted-foreground uppercase">Certificate Number</Label>
                  <Input
                    id="certNo"
                    value={st.certificateNo}
                    onChange={(e) => setSt({ ...st, certificateNo: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="issuingAuth" className="text-xs text-muted-foreground uppercase">Issuing Authority</Label>
                  <Input
                    id="issuingAuth"
                    value={st.issuingAuthority}
                    onChange={(e) => setSt({ ...st, issuingAuthority: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="doi" className="text-xs text-muted-foreground uppercase">Date of Issue</Label>
                  <Input
                    id="doi"
                    type="date"
                    value={st.dateOfIssue}
                    onChange={(e) => setSt({ ...st, dateOfIssue: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-accent p-2 text-accent-foreground">
                <Cloud className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">DigiLocker Integration</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect your DigiLocker to auto-pull verified digital caste and academic records.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Link2 className="size-4" aria-hidden /> Active on portal
            </Button>
          </div>
        </TabsContent>

        {/* FAMILY & INCOME */}
        <TabsContent value="family" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Family Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="father" className="text-xs text-muted-foreground uppercase">Father's Name</Label>
                  <Input
                    id="father"
                    value={family.fatherName}
                    onChange={(e) => setFamily({ ...family, fatherName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mother" className="text-xs text-muted-foreground uppercase">Mother's Name</Label>
                  <Input
                    id="mother"
                    value={family.motherName}
                    onChange={(e) => setFamily({ ...family, motherName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="guardian" className="text-xs text-muted-foreground uppercase">Guardian Name</Label>
                  <Input
                    id="guardian"
                    value={family.guardian}
                    onChange={(e) => setFamily({ ...family, guardian: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="siblings" className="text-xs text-muted-foreground uppercase">Number of Siblings</Label>
                  <Input
                    id="siblings"
                    value={family.siblings}
                    onChange={(e) => setFamily({ ...family, siblings: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Income Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="incomeAnnual" className="text-xs text-muted-foreground uppercase">Annual Family Income</Label>
                  <Input
                    id="incomeAnnual"
                    value={income.annual}
                    onChange={(e) => setIncome({ ...income, annual: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="incomeSource" className="text-xs text-muted-foreground uppercase">Primary Income Source</Label>
                  <Input
                    id="incomeSource"
                    value={income.source}
                    onChange={(e) => setIncome({ ...income, source: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACADEMIC HISTORY */}
        <TabsContent value="academic" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-primary" aria-hidden /> Academic Qualifications & Marksheets
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addAcademicRow}>
                <Plus className="size-4" aria-hidden /> Add Qualification
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Level / Examination</th>
                    <th className="px-5 py-3 font-semibold">Board / University</th>
                    <th className="px-5 py-3 font-semibold w-28">Year</th>
                    <th className="px-5 py-3 font-semibold w-32">Percentage / Marks</th>
                    <th className="px-5 py-3 font-semibold w-16">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {academic.map((a, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-5 py-2">
                        <Input
                          value={a.level}
                          onChange={(e) => {
                            const next = [...academic];
                            next[idx].level = e.target.value;
                            setAcademic(next);
                          }}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2">
                        <Input
                          value={a.board}
                          onChange={(e) => {
                            const next = [...academic];
                            next[idx].board = e.target.value;
                            setAcademic(next);
                          }}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2">
                        <Input
                          value={a.year}
                          onChange={(e) => {
                            const next = [...academic];
                            next[idx].year = e.target.value;
                            setAcademic(next);
                          }}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2">
                        <Input
                          value={a.marks}
                          onChange={(e) => {
                            const next = [...academic];
                            next[idx].marks = e.target.value;
                            setAcademic(next);
                          }}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAcademicRow(idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSTITUTION */}
        <TabsContent value="institution" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Current Enrolled Institution Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor="instName" className="text-xs text-muted-foreground uppercase">Institution / University</Label>
                  <Input
                    id="instName"
                    value={institution.name}
                    onChange={(e) => setInstitution({ ...institution, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="instReg" className="text-xs text-muted-foreground uppercase">University Registration No</Label>
                  <Input
                    id="instReg"
                    value={institution.universityReg}
                    onChange={(e) => setInstitution({ ...institution, universityReg: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="instState" className="text-xs text-muted-foreground uppercase">State / District</Label>
                  <Input
                    id="instState"
                    value={`${institution.state} / ${institution.district}`}
                    onChange={(e) => {
                      const [st, dist] = e.target.value.split("/").map((x) => x.trim());
                      setInstitution({ ...institution, state: st || "", district: dist || "" });
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="instCourse" className="text-xs text-muted-foreground uppercase">Course / Programme</Label>
                  <Input
                    id="instCourse"
                    value={institution.course}
                    onChange={(e) => setInstitution({ ...institution, course: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="instYear" className="text-xs text-muted-foreground uppercase">Admission Year</Label>
                  <Input
                    id="instYear"
                    value={institution.admissionYear}
                    onChange={(e) => setInstitution({ ...institution, admissionYear: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="instDur" className="text-xs text-muted-foreground uppercase">Course Duration (Years)</Label>
                  <Input
                    id="instDur"
                    value={institution.durationYears}
                    onChange={(e) => setInstitution({ ...institution, durationYears: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BANK DETAILS */}
        <TabsContent value="bank" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Direct Benefit Transfer (DBT) Bank Account</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor="accNo" className="text-xs text-muted-foreground uppercase">Account Number</Label>
                  <Input
                    id="accNo"
                    value={bank.accountNo}
                    onChange={(e) => setBank({ ...bank, accountNo: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="ifsc" className="text-xs text-muted-foreground uppercase">IFSC Code</Label>
                  <Input
                    id="ifsc"
                    value={bank.ifsc}
                    onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })}
                    className="mt-1 font-mono uppercase"
                  />
                </div>
                <div>
                  <Label htmlFor="holder" className="text-xs text-muted-foreground uppercase">Account Holder Name</Label>
                  <Input
                    id="holder"
                    value={bank.holderName}
                    onChange={(e) => setBank({ ...bank, holderName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bankName" className="text-xs text-muted-foreground uppercase">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bank.bank}
                    onChange={(e) => setBank({ ...bank, bank: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="branch" className="text-xs text-muted-foreground uppercase">Branch</Label>
                  <Input
                    id="branch"
                    value={bank.branch}
                    onChange={(e) => setBank({ ...bank, branch: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">PFMS Validation Status</Label>
                  <div className="mt-2.5">
                    <Badge variant="outline" className="text-leaf border-leaf/30 bg-leaf/5">
                      ✓ Validated for DBT Disbursals
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="flex items-start gap-2 rounded-xl border bg-accent/40 p-4 text-xs text-muted-foreground">
            <Landmark className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Bank account must be Aadhaar-seeded for smooth DBT scholarship credits.
          </p>
        </TabsContent>

        {/* COMMUNICATION & PREFERENCES */}
        <TabsContent value="communication" className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="text-base">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Email notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Instant alerts for status, scrutiny deficiencies, and selection decisions.
                  </p>
                </div>
                <Switch
                  checked={communication.emailNotifs}
                  onCheckedChange={(v) => setCommunication({ ...communication, emailNotifs: v })}
                  aria-label="Email notifications"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <div>
                  <p className="text-sm font-medium">SMS notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Crucial deadline and OTP alerts.
                  </p>
                </div>
                <Switch
                  checked={communication.smsNotifs}
                  onCheckedChange={(v) => setCommunication({ ...communication, smsNotifs: v })}
                  aria-label="SMS notifications"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <div>
                  <p className="text-sm font-medium">WhatsApp updates</p>
                  <p className="text-xs text-muted-foreground">
                    Optional direct messages for application tracking.
                  </p>
                </div>
                <Switch
                  checked={communication.whatsappNotifs}
                  onCheckedChange={(v) => setCommunication({ ...communication, whatsappNotifs: v })}
                  aria-label="WhatsApp notifications"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2 border-t pt-5">
        <Button variant="outline" asChild>
          <Link to="/portal">Back to Dashboard</Link>
        </Button>
        <Button onClick={save} disabled={updateMutation.isPending}>
          <Save className="size-4" aria-hidden /> {updateMutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
