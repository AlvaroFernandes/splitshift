"use client";

import React from "react";
import { useAppData } from "@/hooks/useAppData";
import { Dashboard }      from "./Dashboard";
import { LogEntry }       from "./LogEntry";
import { EntriesList }    from "./EntriesList";
import { WeeklyReport }   from "./WeeklyReport";
import { TFNReport }      from "./TFNReport";
import { ABNInvoice }     from "./ABNInvoice";
import { InvoiceHistory } from "./InvoiceHistory";
import { AdminEditModal }    from "./AdminEditModal";
import { SettingsPage }      from "./SettingsPage";
import { OnboardingWizard }  from "./OnboardingWizard";
import { ActivityLog }       from "./ActivityLog";

export default function WorkHoursTracker() {
  const {
    tab, setTab,
    settings,
    periodStart, periodEnd,
    editEntry,
    toast,
    theme,
    loading,
    invoiceHistory,
    viewingInvoice, setViewingInvoice,
    userRole,
    managedUsers,
    adminEditEntry, setAdminEditEntry,
    adminUserFilter, setAdminUserFilter,
    processed, weeklyData, totals, tfnPct, chartProcessed, TABS, archivedEntries,
    toggleTheme, signOut, updatePeriod, clearPeriod,
    handleSave, handleEdit, handleAdminSave, handleAdminClose,
    handleDelete, handleSettingsSave, handleSaveWorkerRules, handleInvite,
    workerSettings, managedAdmins, clients,
    advanceInvoice, handleDeleteInvoice, handleShareInvoice, handleUpdateInvoice, handleCancelEdit,
    updateInvoiceItems, handleSaveTemplate,
    showReminder, reminderDaysSince, dismissReminder, reminderDismissed,
    showOnboarding, handleCompleteOnboarding,
    managedViewers, auditLog, adminCompanyInfo,
  } = useAppData();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background-tertiary)" }}>
        <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header no-print">
        <div className="logo">
          <i className="ti ti-briefcase" aria-hidden="true" style={{ fontSize: 18, color: "var(--color-text-warning)" }} />
          SplitShift
          {userRole === "admin" && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: "var(--color-text-warning)", color: "#fff", padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em" }}>
              ADMIN
            </span>
          )}
          {userRole === "viewer" && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: "var(--color-text-info)", color: "#fff", padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em" }}>
              VIEWER
            </span>
          )}
        </div>
        <div className="period-row">
          <span>Period:</span>
          <input type="date" value={periodStart} onChange={e => updatePeriod("start", e.target.value)} aria-label="Period start date" />
          <span aria-hidden="true">→</span>
          <input type="date" value={periodEnd}   onChange={e => updatePeriod("end",   e.target.value)} aria-label="Period end date" />
          {(periodStart || periodEnd) && (
            <button className="icon-btn" onClick={clearPeriod} aria-label="Clear period filter" title="Clear period">
              <i className="ti ti-circle-x" aria-hidden="true" />
            </button>
          )}
        </div>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
          <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} aria-hidden="true" />
        </button>
        {userRole !== "viewer" && (
          <button className="icon-btn" onClick={() => setTab("settings")} aria-label="Open settings">
            <i className="ti ti-settings" aria-hidden="true" />
          </button>
        )}
        <button className="icon-btn" onClick={signOut} aria-label="Sign out">
          <i className="ti ti-logout" aria-hidden="true" />
        </button>
      </header>

      <nav className="tabbar no-print" aria-label="Main navigation">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>

      {showReminder && !reminderDismissed && (
        <div className="no-print" role="status" style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "var(--color-background-secondary)",
          borderLeft: "3px solid var(--color-text-warning)",
          margin: "0 12px 0",
          borderRadius: "var(--border-radius-md)",
          fontSize: 13,
        }}>
          <i className="ti ti-bell-ringing" aria-hidden="true" style={{ color: "var(--color-text-warning)", fontSize: 16, flexShrink: 0 }} />
          <span style={{ flex: 1, color: "var(--color-text-secondary)" }}>
            {reminderDaysSince < 0
              ? "You haven't logged any hours yet. Start tracking your time!"
              : `You haven't logged hours in ${reminderDaysSince} day${reminderDaysSince !== 1 ? "s" : ""}. Don't forget to track your time!`}
          </span>
          <button className="btn-secondary" onClick={() => { dismissReminder(); setTab("log"); }}
            style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap" }}>
            Log now
          </button>
          <button className="icon-btn-sm" onClick={dismissReminder} aria-label="Dismiss reminder">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      )}

      <main className="main-content">
        {tab === "dashboard" && (
          <Dashboard totals={totals} tfnPct={tfnPct} settings={settings} processed={processed}
            chartProcessed={chartProcessed}
            isAdmin={userRole === "admin"} users={managedUsers}
            periodStart={periodStart} periodEnd={periodEnd} />
        )}
        {tab === "log" && userRole !== "admin" && (
          <LogEntry key={editEntry?.id ?? "new"} editEntry={editEntry}
            onSave={handleSave} onCancel={handleCancelEdit} clients={clients}
            templates={settings.templates ?? []} onSaveTemplate={handleSaveTemplate} />
        )}
        {tab === "entries" && (
          <EntriesList processed={processed} archivedProcessed={archivedEntries} onEdit={handleEdit} onDelete={handleDelete}
            isAdmin={userRole === "admin" || userRole === "viewer"} users={managedUsers}
            isReadOnly={userRole === "viewer"}
            userFilter={adminUserFilter} onUserFilterChange={setAdminUserFilter} />
        )}
        {tab === "weekly" && (
          <WeeklyReport processed={weeklyData} settings={settings} isAdmin={userRole === "admin"}
            isReadOnly={userRole === "viewer"} users={managedUsers}
            onEdit={handleEdit} onDelete={handleDelete} />
        )}
        {tab === "tfn" && userRole !== "admin" && (
          <TFNReport processed={processed} totals={totals} settings={settings}
            periodStart={periodStart} periodEnd={periodEnd} />
        )}
        {tab === "abn" && userRole !== "admin" && (
          <ABNInvoice processed={processed} settings={settings}
            adminCompanyInfo={adminCompanyInfo}
            periodStart={periodStart} periodEnd={periodEnd}
            onAdvance={advanceInvoice} onItemsChange={updateInvoiceItems} />
        )}
        {tab === "history" && userRole !== "admin" && (
          <InvoiceHistory invoices={invoiceHistory} viewing={viewingInvoice}
            onView={setViewingInvoice} pdfNamePattern={settings.pdfNamePattern}
            onDelete={handleDeleteInvoice} onShare={handleShareInvoice} onUpdate={handleUpdateInvoice} />
        )}
        {tab === "activity" && userRole === "admin" && (
          <ActivityLog entries={auditLog} />
        )}
        {tab === "settings" && userRole !== "viewer" && (
          <SettingsPage
            settings={settings} onSave={handleSettingsSave}
            isAdmin={userRole === "admin"}
            managedUsers={managedUsers}
            managedAdmins={managedAdmins}
            managedViewers={managedViewers}
            workerSettings={workerSettings}
            onSaveWorkerRules={handleSaveWorkerRules}
            onInvite={handleInvite}
          />
        )}
      </main>

      {showOnboarding && (
        <OnboardingWizard
          initialSettings={settings}
          onComplete={handleCompleteOnboarding}
          onSkip={() => handleCompleteOnboarding({})}
          isAdmin={userRole === "admin"}
        />
      )}

      {adminEditEntry && (
        <AdminEditModal
          entry={adminEditEntry}
          userName={managedUsers.find(u => u.id === adminEditEntry.ownerId)?.name ?? "Unknown"}
          onSave={handleAdminSave}
          onClose={handleAdminClose}
          clients={clients}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="alert">
          <i className={`ti ${toast.type === "err" ? "ti-alert-circle" : "ti-circle-check"}`} aria-hidden="true" />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
