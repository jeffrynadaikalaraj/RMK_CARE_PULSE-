import React, { useState, useEffect, useRef } from "react";

const UserProfileDropdown = ({ user, onLogout, onViewProfile, onViewTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "Online": return "#10B981";
      case "On-Call": return "#F59E0B";
      case "Emergency Mode": return "#EF4444";
      default: return "#64748B";
    }
  };

  const getAccessBadgeColor = (level) => {
    switch (level) {
      case "High": return "linear-gradient(135deg, #10B981, #059669)";
      case "Medium": return "linear-gradient(135deg, #3B82F6, #2563EB)";
      case "Restricted": return "linear-gradient(135deg, #6B7280, #4B5563)";
      default: return "linear-gradient(135deg, #6B7280, #4B5563)";
    }
  };

  return (
    <div className="profile-dropdown-container" ref={dropdownRef} style={{ position: "relative" }}>
      <style>{`
        .profile-trigger {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 12px;
          border-radius: 99px;
          border: 1px solid rgba(16, 185, 129, 0.2);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
        }

        .profile-trigger:hover {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
        }

        .avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10B981, #3B82F6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          border: 2px solid rgba(255, 255, 255, 0.2);
          position: relative;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid #060D1F;
          position: absolute;
          bottom: -1px;
          right: -1px;
          background: ${getStatusColor(user?.status)};
          animation: ${user?.status === 'Emergency Mode' ? 'pulse-red 1.5s infinite' : 'none'};
        }

        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .dropdown-panel {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 320px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.1);
          padding: 0;
          z-index: 1000;
          overflow: hidden;
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .dropdown-panel.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .dropdown-section {
          padding: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .identity-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .identity-avatar {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: linear-gradient(135deg, #10B981, #3B82F6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.8rem;
          font-weight: 800;
          font-family: 'Syne', sans-serif;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        }

        .identity-details h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #F8FAFC;
          font-family: 'Syne', sans-serif;
          letter-spacing: -0.3px;
        }

        .identity-details p {
          margin: 2px 0;
          font-size: 0.8rem;
          color: #94A3B8;
        }

        .badge-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .access-badge {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 8px;
          border-radius: 6px;
          color: white;
          background: ${getAccessBadgeColor(user?.access_level)};
        }

        .dept-badge {
          font-size: 0.65rem;
          font-weight: 700;
          color: #10B981;
          background: rgba(16, 185, 129, 0.1);
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .account-info {
          display: grid;
          gap: 12px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 0.65rem;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 700;
        }

        .info-value {
          font-size: 0.85rem;
          color: #CBD5E1;
          margin-top: 2px;
        }

        .action-list {
          padding: 8px;
          display: grid;
          gap: 4px;
        }

        .action-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-radius: 12px;
          color: #94A3B8;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #F8FAFC;
        }

        .action-item.logout {
          color: #FCA5A5;
        }

        .action-item.logout:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #F87171;
        }

        .action-icon {
          font-size: 1.1rem;
        }
      `}</style>

      <div className="profile-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="avatar-circle">
          {user?.name?.[0]?.toUpperCase() || "U"}
          <div className="status-dot"></div>
        </div>
        <div style={{ display: "none" }}>{/* Hidden on small screens if needed */}
          <span style={{ color: "#F8FAFC", fontSize: "0.85rem", fontWeight: 600 }}>{user?.name?.split(' ')[0]}</span>
        </div>
        <span style={{ color: "rgba(16, 185, 129, 0.6)", fontSize: "0.7rem" }}>▼</span>
      </div>

      <div className={`dropdown-panel ${isOpen ? 'open' : ''}`}>
        {/* Section 1: User Identity */}
        <div className="dropdown-section" style={{ background: "rgba(16, 185, 129, 0.03)" }}>
          <div className="identity-header">
            <div className="identity-avatar">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="identity-details">
              <h3>{user?.name || "Healthcare Staff"}</h3>
              <p>{user?.role || "Medical Personnel"}</p>
              <div className="badge-row">
                <span className="dept-badge">{user?.department || "General"}</span>
                <span className="access-badge">{user?.access_level || "Restricted"}</span>
              </div>
            </div>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: "#475569", fontWeight: 600 }}>STAFF ID: <span style={{ color: "#94A3B8" }}>{user?.staff_id || "NOT-ASSIGNED"}</span></p>
        </div>

        {/* Section 2: Account Information */}
        <div className="dropdown-section">
          <div className="account-info">
            <div className="info-item">
              <span className="info-label">Email Address</span>
              <span className="info-value">{user?.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Last Synchronization</span>
              <span className="info-value">{user?.last_login ? new Date(user.last_login).toLocaleString() : "First Session"}</span>
            </div>
            <div className="info-item">
              <span className="info-label">System Status</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: getStatusColor(user?.status) }}></div>
                <span style={{ fontSize: "0.85rem", color: getStatusColor(user?.status), fontWeight: 700 }}>{user?.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Action Controls */}
        <div className="action-list">
          <div className="action-item" onClick={() => { onViewProfile(); setIsOpen(false); }}>
            <span className="action-icon">👤</span>
            <span>View Profile</span>
          </div>
          <div className="action-item" onClick={() => { onViewTab("preferences"); setIsOpen(false); }}>
            <span className="action-icon">⚙️</span>
            <span>System Preferences</span>
          </div>
          <div className="action-item" onClick={() => { onViewTab("security"); setIsOpen(false); }}>
            <span className="action-icon">🔐</span>
            <span>Security Settings</span>
          </div>
          <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.05)", margin: "4px 12px" }}></div>
          <div className="action-item logout" onClick={onLogout}>
            <span className="action-icon">🔒</span>
            <span>Terminate Session</span>
          </div>
        </div>

        <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.2)", textAlign: "center" }}>
          <span style={{ fontSize: "0.6rem", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>CarePulse++ Mission-Critical Environment</span>
        </div>
      </div>
    </div>
  );
};

export default UserProfileDropdown;
