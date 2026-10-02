"""Seed comprehensive flagship scheme (MOTA-008 - NFST) and institution mapping for end-to-end testing."""
from app.core.database import SessionLocal
from app.domain.models import Scheme, SchemeVersion, SchemeRule, User
from app.domain.relational_models import (
    SchemeForm,
    SchemeDocument,
    SchemeSelectionCriterion,
    Institution,
    InstitutionUser,
)
from sqlalchemy import select

def seed():
    db = SessionLocal()
    try:
        # Find MOTA-008
        scheme = db.scalar(select(Scheme).where(Scheme.code == "MOTA-008"))
        if not scheme:
            scheme = Scheme(
                code="MOTA-008",
                name="National Fellowship for Higher Education of ST Students",
                description="Provides financial fellowship support directly to meritorious ST scholars pursuing university M.Phil and Ph.D. research programs.",
                active=True,
            )
            db.add(scheme)
            db.flush()

        # Find or create version
        version = db.scalar(select(SchemeVersion).where(SchemeVersion.scheme_id == scheme.id, SchemeVersion.version == "v1.0"))
        if not version:
            version = SchemeVersion(
                scheme_id=scheme.id,
                version="v1.0",
                status="PUBLISHED",
                configuration={
                    "cycle": "2026-2027",
                    "level": "Ph.D & Research Fellowship",
                    "slots": 750,
                    "award_amount": "₹31,000/month (JRF) / ₹35,000/month (SRF) + Contingency",
                    "deadline": "2026-10-31",
                },
            )
            db.add(version)
            db.flush()
        else:
            version.status = "PUBLISHED"
            version.configuration = {
                "cycle": "2026-2027",
                "level": "Ph.D & Research Fellowship",
                "slots": 750,
                "award_amount": "₹31,000/month (JRF) / ₹35,000/month (SRF) + Contingency",
                "deadline": "2026-10-31",
            }

        # Form definition
        form_def = {
            "sections": [
                {
                    "id": "sec_personal",
                    "title": "Personal & ST Identity",
                    "fields": [
                        {"id": "fullName", "label": "Full Name", "type": "text", "required": True},
                        {"id": "dob", "label": "Date of Birth", "type": "date", "required": True},
                        {"id": "gender", "label": "Gender", "type": "dropdown", "options": ["Female", "Male", "Other"], "required": True},
                        {"id": "tribe", "label": "ST Community / Sub-Tribe", "type": "text", "required": True},
                        {"id": "casteCertNo", "label": "Caste Certificate Number", "type": "text", "required": True},
                        {"id": "domicileState", "label": "Domicile State", "type": "text", "required": True},
                    ],
                },
                {
                    "id": "sec_academic",
                    "title": "Academic Background",
                    "fields": [
                        {"id": "postGradUniversity", "label": "Post-Graduation University", "type": "text", "required": True},
                        {"id": "postGradSubject", "label": "Post-Graduation Subject / Stream", "type": "text", "required": True},
                        {"id": "postGradMarks", "label": "Post-Graduation Percentage / CGPA", "type": "number", "required": True},
                        {"id": "netQualified", "label": "UGC-NET / CSIR-NET Qualified?", "type": "dropdown", "options": ["Yes", "No"], "required": True},
                        {"id": "netRollNo", "label": "NET Roll Number / Year", "type": "text", "when": {"field": "netQualified", "equals": "Yes"}},
                    ],
                },
                {
                    "id": "sec_research",
                    "title": "Ph.D / Research Details",
                    "fields": [
                        {"id": "institutionName", "label": "Enrolled University / Research Institution", "type": "text", "required": True},
                        {"id": "department", "label": "Department / Faculty", "type": "text", "required": True},
                        {"id": "researchTopic", "label": "Ph.D Research Topic / Area", "type": "text", "required": True},
                        {"id": "supervisorName", "label": "Research Supervisor Name", "type": "text", "required": True},
                        {"id": "phdRegDate", "label": "Ph.D Registration Date", "type": "date", "required": True},
                    ],
                },
                {
                    "id": "sec_bank",
                    "title": "Direct Benefit Transfer (DBT) Bank Account",
                    "fields": [
                        {"id": "bankName", "label": "Bank Name", "type": "text", "required": True},
                        {"id": "accountNo", "label": "Account Number", "type": "text", "required": True},
                        {"id": "ifscCode", "label": "IFSC Code", "type": "text", "required": True},
                        {"id": "branchName", "label": "Branch", "type": "text", "required": True},
                    ],
                },
            ]
        }

        form_row = db.scalar(select(SchemeForm).where(SchemeForm.scheme_version_id == version.id))
        if not form_row:
            form_row = SchemeForm(scheme_version_id=version.id, definition=form_def)
            db.add(form_row)
        else:
            form_row.definition = form_def

        # Scheme Documents
        required_docs = [
            ("CASTE_CERTIFICATE", "Scheduled Tribe (ST) Certificate", True),
            ("MARKSHEET", "Master's Degree Marksheet / Grade Sheet", True),
            ("ENROLMENT_CERTIFICATE", "Ph.D Admission / Enrolment Letter", True),
            ("INCOME_CERTIFICATE", "Income Certificate / Self-Declaration", False),
            ("BANK_PASSBOOK", "Bank Passbook First Page / Cancelled Cheque", True),
        ]

        for code, label, req in required_docs:
            doc_row = db.scalar(select(SchemeDocument).where(SchemeDocument.scheme_version_id == version.id, SchemeDocument.document_code == code))
            if not doc_row:
                doc_row = SchemeDocument(
                    scheme_version_id=version.id,
                    document_code=code,
                    label=label,
                    required=req,
                    status="ACTIVE",
                )
                db.add(doc_row)
            else:
                doc_row.label = label
                doc_row.required = req
                doc_row.status = "ACTIVE"

        # Scheme Selection Criteria
        criteria = [
            ("ACADEMIC_MERIT", 50.0, "PERCENTAGE_BASED", 0.0, 100.0),
            ("RESEARCH_SYNOPSIS", 30.0, "COMMITTEE_SCORE", 0.0, 100.0),
            ("PVTG_PRIORITY", 20.0, "CATEGORY_BONUS", 0.0, 100.0),
        ]
        for code, weight, method, mini, maxi in criteria:
            crit_row = db.scalar(select(SchemeSelectionCriterion).where(SchemeSelectionCriterion.scheme_version_id == version.id, SchemeSelectionCriterion.criterion_code == code))
            if not crit_row:
                crit_row = SchemeSelectionCriterion(
                    scheme_version_id=version.id,
                    criterion_code=code,
                    weight=weight,
                    calculation_method=method,
                    minimum=mini,
                    maximum=maxi,
                    status="ACTIVE",
                )
                db.add(crit_row)

        # Seed Institution and Link to institution user
        inst = db.scalar(select(Institution).where(Institution.code == "INST-RANCHI-01"))
        if not inst:
            inst = Institution(
                code="INST-RANCHI-01",
                name="Ranchi University",
                institution_type="Central / State University",
                state="Jharkhand",
                district="Ranchi",
                status="ACTIVE",
            )
            db.add(inst)
            db.flush()

        inst_user = db.scalar(select(User).where(User.email == "institution@mota.gov.in"))
        if inst_user:
            link = db.scalar(select(InstitutionUser).where(InstitutionUser.institution_id == inst.id, InstitutionUser.user_id == inst_user.id))
            if not link:
                link = InstitutionUser(institution_id=inst.id, user_id=inst_user.id, status="ACTIVE")
                db.add(link)

        db.commit()
        print(f"Successfully configured and enabled flagship scheme: {scheme.name} ({scheme.code}) with published version {version.version} and institution {inst.name}")
    except Exception as e:
        db.rollback()
        print("Error seeding scheme:", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
