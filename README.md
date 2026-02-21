# CarePulse++ ⚕️

CarePulse++ is a unified **Deterministic Healthcare Intelligence Engine** designed for mission-critical hospital environments. It integrates real-time clinical risk monitoring with operational resource management using a purely mathematical and rule-based architecture.

## 🚀 core Philosophy
The system operates on a **100% Deterministic Framework**, ensuring identical clinical inputs always yield identical operational decisions. It eliminates the "black box" nature of AI in healthcare, providing a transparent, O(n) complexity decision trail for hospital staff.

---

## 🏛️ System Architecture

### 1. Clinical Risk Engine (The "Brain")
The heart of CarePulse++ is its weighted mathematical modeling of patient vitals.
- **Weighted Scoring**: Multi-parameter vital analysis (SpO2, BP, HR, Temp, Sugar, BMI, etc.) with strict weight distribution (Σ Weights = 1.0).
- **Escalation Logic**: Automatic risk multipliers for Chronic Diseases and Emergency cases.
- **Severity Classification**:
  - 🔴 **Critical (70-100)**: Immediate ICU priority.
  - 🟡 **Moderate (40-69)**: Targeted clinical observation.
  - 🟢 **Stable (0-39)**: Ward observation.

### 2. Operational Intelligence
- **Hospital Stress Index (HSI)**: A multi-factor index monitoring Bed/ICU availability, ER Load, Surgical pressure, and Ventilator saturation.
- **Resource Allocation**: A greedy allocation algorithm that matches high-risk patients to critical care resources.
- **ER Decision Logic**: Automated redirection protocols based on real-time capacity loads.

---

## 💻 Tech Stack
- **Frontend**: React 19, Vite, Recharts (Visualizations), Vanilla CSS (Glassmorphism).
- **Backend**: FastAPI (Python), Pandas (Data Processing), SQLAlchemy (ORM).
- **Database**: SQLite (Auth & Staff records).
- **Persistence**: Excel (Global Clinical Datasets), JSON (User Sessions).

---

## 📊 Dataset Requirements
The system strictly operates on two synchronized Excel files:

### 3.1 Patient Clinical Data (`Patient_Clinical_Data.xlsx`)
Tracks 17 clinical attributes including:
- **Vitals**: Heart Rate, Blood Pressure (Sys/Dia), SpO2, Body Temp, Resp Rate.
- **Metabolics**: Blood Sugar, BMI, Hemoglobin, Hydration levels.
- **Flags**: Chronic, Emergency, and ICU requirements.

### 3.2 Hospital Resource Data (`Hospital_Resource_Status.xlsx`)
Monitors 15 operational metrics including:
- Bed/ICU capacity and occupancy.
- Ventilator availability.
- ER Load and medical staff availability (Doctors/Nurses).

---

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend Setup
```bash
# Navigate to root
pip install -r backend/requirements.txt
python backend/main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Security Protocols
- **JWT Authentication**: Cryptographically signed staff sessions.
- **MFA Architecture**: Mandatory Email OTP for mission-critical access.
- **RBAC**: Role-Based Access Control for Doctors, Nurses, and Admin staff.
- **Transparency**: Every clinical decision (Diet, Bed, Risk) is accompanied by the underlying mathematical justification.

---

## ⚖️ License
Mission-Critical Hospital Environment License - Dedicated to Precision Healthcare.
