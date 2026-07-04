import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  Activity,
  ClipboardList,
  Clock,
  Database,
  FileCheck2,
  History,
  MapPin,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { db } from "../firebase";
import {
  Candidate,
  AuditLogEntry,
  Position,
  Section,
  SectionTally,
  Strand,
} from "../types";
import {
  getCandidateAlliance,
  getPositionDisplayName,
  getSectionSubmissionStatus,
} from "../utils";

interface AdminDashboardProps {
  strands: Strand[];
  sections: Section[];
  positions: Position[];
  candidates: Candidate[];
  tallies: SectionTally[];
  auditLogs: AuditLogEntry[];
}

type PositionDraft = {
  name: string;
  type: "ASCO" | "STRAND";
  strandId: string;
};

export default function AdminDashboard({
  strands,
  sections,
  positions,
  candidates,
  tallies,
  auditLogs,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"TALLY" | "CONFIG" | "LOGS">(
    "TALLY",
  );
  const [selectedStrand, setSelectedStrand] = useState(strands[0]?.id || "");
  const [selectedSection, setSelectedSection] = useState("");
  const [ballotsCast, setBallotsCast] = useState(0);
  const [voteInputs, setVoteInputs] = useState<Record<string, number>>({});
  const [abstainInputs, setAbstainInputs] = useState<Record<string, number>>(
    {},
  );
  const [officerName, setOfficerName] = useState("");
  const [saving, setSaving] = useState(false);

  const [newStrand, setNewStrand] = useState({ id: "", name: "", desc: "" });
  const [newSection, setNewSection] = useState({
    id: "",
    name: "",
    strandId: "",
    pop: 40,
  });
  const [newPosition, setNewPosition] = useState<PositionDraft>({
    name: "",
    type: "ASCO",
    strandId: "",
  });
  const [newCandidate, setNewCandidate] = useState({
    name: "",
    scope: "ASCO",
    posId: "",
    strandId: "",
    alliance: "",
    color: "blue",
  });

  const selectedSectionData = sections.find(
    (section) => section.id === selectedSection,
  );
  const selectedStrandData = selectedSectionData
    ? strands.find((strand) => strand.id === selectedSectionData.strandId)
    : undefined;
  const selectedCandidatePosition = positions.find(
    (position) => position.id === newCandidate.posId,
  );
  const candidatePositionOptions = useMemo(() => {
    if (newCandidate.scope === "ASCO") {
      return positions
        .filter((position) => position.type === "ASCO")
        .sort((a, b) => a.order - b.order);
    }

    if (!newCandidate.strandId) {
      return [];
    }

    return positions
      .filter(
        (position) =>
          position.type === "STRAND" &&
          position.strandId === newCandidate.strandId,
      )
      .sort((a, b) => a.order - b.order);
  }, [newCandidate.scope, newCandidate.strandId, positions]);
  const existingTally = tallies.find(
    (tally) => tally.sectionId === selectedSection,
  );

  const ascoPositions = useMemo(
    () =>
      positions
        .filter((position) => position.type === "ASCO")
        .sort((a, b) => a.order - b.order),
    [positions],
  );
  const strandPositions = useMemo(
    () =>
      positions
        .filter(
          (position) =>
            position.type === "STRAND" &&
            (!position.strandId ||
              position.strandId === selectedSectionData?.strandId),
        )
        .sort((a, b) => a.order - b.order),
    [positions, selectedSectionData?.strandId],
  );
  const sectionSubmissionSet = useMemo(
    () => new Set(tallies.map((tally) => tally.sectionId)),
    [tallies],
  );
  const sectionProgressRows = useMemo(
    () =>
      strands.map((strand) => ({
        strand,
        strandSections: sections.filter(
          (section) => section.strandId === strand.id,
        ),
      })),
    [sections, strands],
  );

  useEffect(() => {
    if (!selectedStrand && strands[0]) setSelectedStrand(strands[0].id);
  }, [selectedStrand, strands]);

  useEffect(() => {
    if (existingTally) {
      setBallotsCast(existingTally.ballotsCast);
      setVoteInputs({
        ...(existingTally.votes || {}),
        ...(existingTally.asco?.votes || {}),
        ...(existingTally.strand?.votes || {}),
      });
      setAbstainInputs({
        ...(existingTally.abstains || {}),
        ...(existingTally.asco?.abstains || {}),
        ...(existingTally.strand?.abstains || {}),
      });
      setOfficerName(existingTally.submittedBy);
    } else {
      setBallotsCast(0);
      setVoteInputs({});
      setAbstainInputs({});
      setOfficerName("");
    }
  }, [existingTally, selectedSection, tallies]);

  const filteredSections = sections.filter(
    (section) => section.strandId === selectedStrand,
  );

  const addLog = async (action: string, details: string) => {
    await addDoc(collection(db, "audit_logs"), {
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  };

  const buildPositionId = (
    name: string,
    type: "ASCO" | "STRAND",
    strandId?: string,
  ) =>
    [type, strandId || "GLOBAL", name]
      .filter(Boolean)
      .join("-")
      .replace(/\s+/g, "-")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleSaveTally = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection || !officerName) {
      alert("Please select a section and provide officer name.");
      return;
    }

    setSaving(true);
    try {
      const ascoPositionIds = new Set(
        ascoPositions.map((position) => position.id),
      );
      const strandPositionIds = new Set(
        strandPositions
          .filter(
            (position) => position.strandId === selectedSectionData?.strandId,
          )
          .map((position) => position.id),
      );
      const ascoCandidateIds = new Set(
        candidates
          .filter((candidate) => ascoPositionIds.has(candidate.positionId))
          .map((candidate) => candidate.id),
      );
      const strandCandidateIds = new Set(
        candidates
          .filter((candidate) => strandPositionIds.has(candidate.positionId))
          .map((candidate) => candidate.id),
      );
      const ascoVotes = Object.fromEntries(
        Object.entries(voteInputs).filter(([candidateId]) =>
          ascoCandidateIds.has(candidateId),
        ),
      );
      const strandVotes = Object.fromEntries(
        Object.entries(voteInputs).filter(([candidateId]) =>
          strandCandidateIds.has(candidateId),
        ),
      );
      const ascoAbstains = Object.fromEntries(
        Object.entries(abstainInputs).filter(([positionId]) =>
          ascoPositionIds.has(positionId),
        ),
      );
      const strandAbstains = Object.fromEntries(
        Object.entries(abstainInputs).filter(([positionId]) =>
          strandPositionIds.has(positionId),
        ),
      );
      const submittedAt = new Date().toISOString();

      await setDoc(doc(db, "tallies", selectedSection), {
        sectionId: selectedSection,
        ballotsCast,
        votes: {
          ...ascoVotes,
          ...strandVotes,
        },
        abstains: {
          ...ascoAbstains,
          ...strandAbstains,
        },
        asco: {
          votes: ascoVotes,
          abstains: ascoAbstains,
          submittedAt,
          submittedBy: officerName,
        },
        strand: {
          votes: strandVotes,
          abstains: strandAbstains,
          submittedAt,
          submittedBy: officerName,
        },
        submittedModes: {
          asco: true,
          strand: true,
        },
        updatedAt: submittedAt,
        submittedBy: officerName,
      });
      await addLog(
        "TALLY_SUBMIT",
        `ASCO and strand tallies submitted for section ${selectedSection} by ${officerName}`,
      );
      alert("Tally saved successfully!");
    } catch (error) {
      console.error(error);
      alert("Error saving tally");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTally = async (sectionId: string) => {
    if (!window.confirm("Delete this section tally?")) return;
    await deleteDoc(doc(db, "tallies", sectionId));
    await addLog("TALLY_DELETE", `Deleted tally for section ${sectionId}`);
  };

  const handleInitializeSystem = async () => {
    if (!window.confirm("Initialize election system with standard positions?"))
      return;

    const batch = writeBatch(db);
    const starterPositions: Array<Position & { strandId?: string | null }> = [
      { id: "PRESIDENT", name: "President", type: "ASCO", order: 1 },
      { id: "VICE-PRESIDENT", name: "Vice President", type: "ASCO", order: 2 },
      { id: "SECRETARY", name: "Secretary", type: "ASCO", order: 3 },
      {
        id: "STRAND-REP",
        name: "Representative",
        type: "STRAND",
        strandId: strands[0]?.id,
        order: 4,
      },
    ];

    starterPositions.forEach((position) => {
      batch.set(doc(db, "positions", position.id), position);
    });

    try {
      await batch.commit();
      await addLog("SYSTEM_INIT", "System initialized with starter positions");
      alert("System initialized!");
    } catch (error) {
      console.error(error);
      alert("Initialization failed");
    }
  };

  const handleAddStrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrand.id || !newStrand.name) return;

    await setDoc(doc(db, "strands", newStrand.id), {
      name: newStrand.name,
      description: newStrand.desc,
    });
    await addLog("CONFIG_ADD", `Added strand: ${newStrand.id}`);
    setNewStrand({ id: "", name: "", desc: "" });
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSection.id || !newSection.strandId) return;

    await setDoc(doc(db, "sections", newSection.id), {
      name: newSection.name,
      strandId: newSection.strandId,
      voterPopulation: newSection.pop,
    });
    await addLog("CONFIG_ADD", `Added section: ${newSection.id}`);
    setNewSection({ id: "", name: "", strandId: "", pop: 40 });
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosition.name) return;

    const id = buildPositionId(
      newPosition.name,
      newPosition.type,
      newPosition.type === "STRAND" ? newPosition.strandId : undefined,
    );
    if (positions.some((position) => position.id === id)) {
      alert("A position with this name already exists for that scope.");
      return;
    }
    await setDoc(doc(db, "positions", id), {
      name: newPosition.name,
      type: newPosition.type,
      strandId:
        newPosition.type === "STRAND" ? newPosition.strandId || null : null,
      order: positions.length + 1,
    });
    await addLog("CONFIG_ADD", `Added position: ${newPosition.name}`);
    setNewPosition({ name: "", type: "ASCO", strandId: "" });
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.name || !newCandidate.posId) return;

    const id = `CAND-${Date.now()}`;
    await setDoc(doc(db, "candidates", id), {
      name: newCandidate.name,
      positionId: newCandidate.posId,
      strandId: newCandidate.strandId || null,
      alliance: newCandidate.alliance,
      party: newCandidate.alliance,
      color: newCandidate.color,
    });
    await addLog("CONFIG_ADD", `Added candidate: ${newCandidate.name}`);
    setNewCandidate({
      name: "",
      scope: "ASCO",
      posId: "",
      strandId: "",
      alliance: "",
      color: "blue",
    });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-navy text-white p-8 rounded-2xl shadow-xl relative overflow-hidden border-none">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-5">
          <div className="p-3.5 bg-gold text-navy rounded-2xl shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight leading-none">
              Admin Console
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                Management Portal
              </span>
              <span className="w-1 h-1 rounded-full bg-gold/50" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                Real-time DB Active
              </span>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
          {(["TALLY", "CONFIG", "LOGS"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab ? "bg-gold text-navy shadow-lg" : "hover:bg-white/5 text-white/70"}`}
            >
              {tab === "TALLY"
                ? "Tally Entry"
                : tab === "CONFIG"
                  ? "System Setup"
                  : "Audit Logs"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "TALLY" && (
          <motion.div
            key="tally"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-6">
              <div className="card space-y-10 border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-navy">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-navy uppercase tracking-tight">
                        Vote Entry Panel
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Submit aggregated results from physical ballot boxes
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveTally} className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2.5">
                      <label className="label-text">1. Filter by Strand</label>
                      <select
                        className="input-field h-12"
                        value={selectedStrand}
                        onChange={(e) => setSelectedStrand(e.target.value)}
                      >
                        <option value="">-- Select Strand --</option>
                        {strands.map((strand) => (
                          <option key={strand.id} value={strand.id}>
                            {strand.name} ({strand.id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="label-text">2. Select Section</label>
                      <select
                        className="input-field h-12"
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        disabled={!selectedStrand}
                      >
                        <option value="">-- Choose Section --</option>
                        {filteredSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedSection && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                        <div>
                          <h4 className="text-sm font-black text-navy uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                            <Percent className="w-4 h-4 text-gold" /> Total
                            Turnout
                          </h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Input the total number of paper ballots physically
                            cast in this section's box.
                          </p>
                        </div>
                        <input
                          type="number"
                          className="input-field text-3xl font-black text-center h-20 shadow-sm border-2 border-slate-200 focus:border-navy"
                          placeholder="0"
                          value={ballotsCast || ""}
                          onChange={(e) =>
                            setBallotsCast(Number(e.target.value))
                          }
                          required
                        />
                      </div>

                      <div className="space-y-8">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-navy" />
                          <h4 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                            Candidate Tally Points
                          </h4>
                        </div>
                        <div className="space-y-6">
                          <div className="p-4 rounded-2xl bg-navy text-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
                                Selected Section
                              </p>
                              <p className="text-sm font-black uppercase tracking-wide">
                                {selectedSectionData?.name || selectedSection}
                              </p>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                              {selectedStrandData
                                ? `${selectedStrandData.name} (${selectedStrandData.id})`
                                : "No strand selected"}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold">
                                    Column 1
                                  </p>
                                  <h5 className="text-sm font-black uppercase tracking-wide text-navy">
                                    ASCO
                                  </h5>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                  Applies to all sections
                                </span>
                              </div>

                              <div className="space-y-4">
                                {ascoPositions.map((position) => {
                                  const applicableCandidates =
                                    candidates.filter(
                                      (candidate) =>
                                        candidate.positionId === position.id,
                                    );

                                  return (
                                    <div
                                      key={position.id}
                                      className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                                    >
                                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                        <div className="min-w-0">
                                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                                            Position
                                          </p>
                                          <p className="text-xs font-black uppercase tracking-wide text-navy truncate">
                                            {getPositionDisplayName(
                                              position,
                                              strands,
                                            )}
                                          </p>
                                        </div>
                                        <label className="space-y-1 shrink-0 w-28">
                                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                            Abstain
                                          </span>
                                          <input
                                            type="number"
                                            className="input-field h-11 text-center font-black text-navy"
                                            placeholder="0"
                                            value={
                                              abstainInputs[position.id] || ""
                                            }
                                            onChange={(e) =>
                                              setAbstainInputs((prev) => ({
                                                ...prev,
                                                [position.id]: Number(
                                                  e.target.value,
                                                ),
                                              }))
                                            }
                                          />
                                        </label>
                                      </div>

                                      <div className="space-y-3">
                                        {applicableCandidates.length > 0 ? (
                                          applicableCandidates.map(
                                            (candidate) => (
                                              <div
                                                key={candidate.id}
                                                className="grid grid-cols-1 md:grid-cols-[minmax(180px,1fr)_120px] gap-3 items-center rounded-xl bg-white border border-slate-100 p-3"
                                              >
                                                <div className="min-w-0">
                                                  <p className="text-sm font-black uppercase tracking-wide text-navy truncate">
                                                    {candidate.name}
                                                  </p>
                                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                                    {getCandidateAlliance(
                                                      candidate,
                                                    )}
                                                  </p>
                                                </div>
                                                <label className="space-y-1">
                                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                    Vote
                                                  </span>
                                                  <input
                                                    type="number"
                                                    className="input-field h-11 text-center font-black text-navy"
                                                    placeholder="0"
                                                    value={
                                                      voteInputs[
                                                        candidate.id
                                                      ] || ""
                                                    }
                                                    onChange={(e) =>
                                                      setVoteInputs((prev) => ({
                                                        ...prev,
                                                        [candidate.id]: Number(
                                                          e.target.value,
                                                        ),
                                                      }))
                                                    }
                                                  />
                                                </label>
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                                            No ASCO candidates configured
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold">
                                    Column 2
                                  </p>
                                  <h5 className="text-sm font-black uppercase tracking-wide text-navy">
                                    Strand
                                  </h5>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                  {selectedStrandData
                                    ? selectedStrandData.name
                                    : "Select strand first"}
                                </span>
                              </div>

                              <div className="space-y-4">
                                {strandPositions
                                  .filter(
                                    (position) =>
                                      position.strandId ===
                                      selectedSectionData?.strandId,
                                  )
                                  .map((position) => {
                                    const applicableCandidates =
                                      candidates.filter(
                                        (candidate) =>
                                          candidate.positionId ===
                                            position.id &&
                                          candidate.strandId ===
                                            selectedSectionData?.strandId,
                                      );

                                    return (
                                      <div
                                        key={position.id}
                                        className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                                      >
                                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                          <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                                              Position
                                            </p>
                                            <p className="text-xs font-black uppercase tracking-wide text-navy truncate">
                                              {getPositionDisplayName(
                                                position,
                                                strands,
                                              )}
                                            </p>
                                          </div>
                                          <label className="space-y-1 shrink-0 w-28">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                              Abstain
                                            </span>
                                            <input
                                              type="number"
                                              className="input-field h-11 text-center font-black text-navy"
                                              placeholder="0"
                                              value={
                                                abstainInputs[position.id] || ""
                                              }
                                              onChange={(e) =>
                                                setAbstainInputs((prev) => ({
                                                  ...prev,
                                                  [position.id]: Number(
                                                    e.target.value,
                                                  ),
                                                }))
                                              }
                                            />
                                          </label>
                                        </div>

                                        <div className="space-y-3">
                                          {applicableCandidates.length > 0 ? (
                                            applicableCandidates.map(
                                              (candidate) => (
                                                <div
                                                  key={candidate.id}
                                                  className="grid grid-cols-1 md:grid-cols-[minmax(180px,1fr)_120px] gap-3 items-center rounded-xl bg-white border border-slate-100 p-3"
                                                >
                                                  <div className="min-w-0">
                                                    <p className="text-sm font-black uppercase tracking-wide text-navy truncate">
                                                      {candidate.name}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                                      {getCandidateAlliance(
                                                        candidate,
                                                      )}
                                                    </p>
                                                  </div>
                                                  <label className="space-y-1">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                      Vote
                                                    </span>
                                                    <input
                                                      type="number"
                                                      className="input-field h-11 text-center font-black text-navy"
                                                      placeholder="0"
                                                      value={
                                                        voteInputs[
                                                          candidate.id
                                                        ] || ""
                                                      }
                                                      onChange={(e) =>
                                                        setVoteInputs(
                                                          (prev) => ({
                                                            ...prev,
                                                            [candidate.id]:
                                                              Number(
                                                                e.target.value,
                                                              ),
                                                          }),
                                                        )
                                                      }
                                                    />
                                                  </label>
                                                </div>
                                              ),
                                            )
                                          ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                                              No strand candidates configured
                                              for this section
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-8">
                        <div className="w-full sm:flex-1">
                          <label className="label-text">
                            Attesting COMELEC Officer
                          </label>
                          <input
                            type="text"
                            className="input-field h-12"
                            placeholder="Type Full Name for Digital Signature"
                            value={officerName}
                            onChange={(e) => setOfficerName(e.target.value)}
                            required
                          />
                        </div>
                        <button
                          disabled={saving}
                          className="btn-primary h-12 px-12 w-full sm:w-auto text-xs"
                        >
                          {saving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}{" "}
                          Commit Section Tally
                        </button>
                      </div>
                    </motion.div>
                  )}
                </form>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="card space-y-8 border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                    Aggregated Reports
                  </h3>
                  <span className="text-[10px] font-black bg-navy text-white px-2 py-0.5 rounded-full">
                    {tallies.length}
                  </span>
                </div>
                <div className="space-y-4 max-h-150 overflow-y-auto pr-2 scrollbar-hidden">
                  {tallies.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 space-y-4 border-2 border-dashed border-slate-100 rounded-2xl">
                      <FileCheck2 className="w-10 h-10 mx-auto opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        No Reports Synced
                      </p>
                    </div>
                  ) : (
                    tallies.map((tally) => {
                      const section = sections.find(
                        (entry) => entry.id === tally.sectionId,
                      );
                      return (
                        <div
                          key={tally.sectionId}
                          className="p-5 bg-white rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-slate-300 transition-all shadow-xs"
                        >
                          <div>
                            <p className="text-xs font-black text-navy uppercase tracking-tight">
                              {section?.name || tally.sectionId}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {tally.submittedBy}
                            </p>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mt-1">
                              {getSectionSubmissionStatus(tally) === "submitted"
                                ? "Complete"
                                : getSectionSubmissionStatus(tally) ===
                                    "partial"
                                  ? "Partial"
                                  : "Pending"}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-black text-navy font-mono leading-none">
                                {tally.ballotsCast}
                              </p>
                              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                                Votes
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteTally(tally.sectionId)}
                              className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-12 card space-y-8 border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl text-gold">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                  Section Tally Progress
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-hidden">
                {sectionProgressRows.map(({ strand, strandSections }) => (
                  <div
                    key={strand.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-navy">
                        {strand.name}
                      </p>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {strandSections.length} sections
                      </span>
                    </div>
                    <div className="space-y-2">
                      {strandSections.map((section) => {
                        const submitted = sectionSubmissionSet.has(section.id);
                        return (
                          <div
                            key={section.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${submitted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-wide truncate">
                                {section.name}
                              </p>
                              <p className="text-[9px] font-bold uppercase tracking-widest">
                                {section.id}
                              </p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {submitted
                                ? getSectionSubmissionStatus(
                                    tallies.find(
                                      (entry) => entry.sectionId === section.id,
                                    ),
                                  ) === "submitted"
                                  ? "Complete"
                                  : "Partial"
                                : "Pending"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "CONFIG" && (
          <motion.div
            key="config"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-8"
          >
            {positions.length === 0 && (
              <div className="card bg-amber-50 border-amber-200 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4 text-amber-800">
                  <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black uppercase tracking-tight text-lg">
                      System Initialization Required
                    </h4>
                    <p className="text-sm font-medium opacity-80 mt-1">
                      Firestore collections are empty. Initialize with standard
                      school election positions to get started.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleInitializeSystem}
                  className="btn-primary bg-amber-600 hover:bg-amber-700 border-none px-8 h-12 shrink-0"
                >
                  <Database className="w-4 h-4" /> Initialize Data
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="card space-y-8 border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-gold">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                    Election Positions
                  </h3>
                </div>
                <form onSubmit={handleAddPosition} className="space-y-4">
                  <input
                    className="input-field"
                    placeholder="Position Name"
                    value={newPosition.name}
                    onChange={(e) =>
                      setNewPosition({ ...newPosition, name: e.target.value })
                    }
                    required
                  />
                  <select
                    className="input-field"
                    value={newPosition.type}
                    onChange={(e) =>
                      setNewPosition({
                        ...newPosition,
                        type: e.target.value as "ASCO" | "STRAND",
                        strandId:
                          e.target.value === "ASCO" ? "" : newPosition.strandId,
                      })
                    }
                  >
                    <option value="ASCO">ASCO</option>
                    <option value="STRAND">Per-Strand</option>
                  </select>
                  {newPosition.type === "STRAND" && (
                    <select
                      className="input-field"
                      value={newPosition.strandId}
                      onChange={(e) =>
                        setNewPosition({
                          ...newPosition,
                          strandId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select Strand</option>
                      {strands.map((strand) => (
                        <option key={strand.id} value={strand.id}>
                          {strand.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="btn-primary w-full h-11">
                    <Plus className="w-4 h-4" /> Add Position
                  </button>
                </form>
                <div className="space-y-3 pt-6 border-t border-slate-50 max-h-72 overflow-y-auto pr-2 scrollbar-hidden">
                  {positions.map((position) => (
                    <div
                      key={position.id}
                      className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 group"
                    >
                      <div className="truncate">
                        <p className="text-[11px] font-black text-navy uppercase tracking-wide truncate">
                          {getPositionDisplayName(position, strands)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {position.type} • {position.id}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await deleteDoc(doc(db, "positions", position.id));
                          addLog(
                            "CONFIG_DELETE",
                            `Deleted position ${position.id}`,
                          );
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card space-y-8 border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-gold">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                    Strand Definitions
                  </h3>
                </div>
                <form onSubmit={handleAddStrand} className="space-y-4">
                  <input
                    className="input-field"
                    placeholder="ID Code (e.g. STEM)"
                    value={newStrand.id}
                    onChange={(e) =>
                      setNewStrand({
                        ...newStrand,
                        id: e.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                  <input
                    className="input-field"
                    placeholder="Strand Display Name"
                    value={newStrand.name}
                    onChange={(e) =>
                      setNewStrand({ ...newStrand, name: e.target.value })
                    }
                    required
                  />
                  <button className="btn-primary w-full h-11">
                    <Plus className="w-4 h-4" /> Add Strand
                  </button>
                </form>
                <div className="space-y-3 pt-6 border-t border-slate-50 max-h-72 overflow-y-auto pr-2 scrollbar-hidden">
                  {strands.map((strand) => (
                    <div
                      key={strand.id}
                      className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 group"
                    >
                      <div className="truncate">
                        <p className="text-[11px] font-black text-navy uppercase tracking-wide truncate">
                          {strand.name}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {strand.id}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await deleteDoc(doc(db, "strands", strand.id));
                          addLog(
                            "CONFIG_DELETE",
                            `Deleted strand ${strand.id}`,
                          );
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card space-y-8 border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-gold">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                    Student Sections
                  </h3>
                </div>
                <form onSubmit={handleAddSection} className="space-y-4">
                  <input
                    className="input-field"
                    placeholder="Section Code (e.g. S12A)"
                    value={newSection.id}
                    onChange={(e) =>
                      setNewSection({
                        ...newSection,
                        id: e.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                  <input
                    className="input-field"
                    placeholder="Display Name"
                    value={newSection.name}
                    onChange={(e) =>
                      setNewSection({ ...newSection, name: e.target.value })
                    }
                    required
                  />
                  <select
                    className="input-field"
                    value={newSection.strandId}
                    onChange={(e) =>
                      setNewSection({ ...newSection, strandId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Strand</option>
                    {strands.map((strand) => (
                      <option key={strand.id} value={strand.id}>
                        {strand.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Voter Population"
                    value={newSection.pop}
                    onChange={(e) =>
                      setNewSection({
                        ...newSection,
                        pop: Number(e.target.value),
                      })
                    }
                    required
                  />
                  <button className="btn-primary w-full h-11">
                    <Plus className="w-4 h-4" /> Add Section
                  </button>
                </form>
                <div className="space-y-3 pt-6 border-t border-slate-50 max-h-72 overflow-y-auto pr-2 scrollbar-hidden">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 group"
                    >
                      <div className="truncate">
                        <p className="text-[11px] font-black text-navy uppercase tracking-wide truncate">
                          {section.name}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {strands.find(
                            (strand) => strand.id === section.strandId,
                          )?.name || section.strandId}{" "}
                          • {section.voterPopulation} Voters
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await deleteDoc(doc(db, "sections", section.id));
                          addLog(
                            "CONFIG_DELETE",
                            `Deleted section ${section.id}`,
                          );
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card space-y-8 border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-gold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                    Election Candidates
                  </h3>
                </div>
                <form onSubmit={handleAddCandidate} className="space-y-4">
                  <input
                    className="input-field"
                    placeholder="Full Candidate Name"
                    value={newCandidate.name}
                    onChange={(e) =>
                      setNewCandidate({ ...newCandidate, name: e.target.value })
                    }
                    required
                  />
                  <select
                    className="input-field"
                    value={newCandidate.scope}
                    onChange={(e) =>
                      setNewCandidate({
                        ...newCandidate,
                        scope: e.target.value as "ASCO" | "STRAND",
                        posId: "",
                        strandId:
                          e.target.value === "ASCO"
                            ? ""
                            : newCandidate.strandId,
                      })
                    }
                    required
                  >
                    <option value="ASCO">ASCO</option>
                    <option value="STRAND">Strands</option>
                  </select>
                  {newCandidate.scope === "STRAND" && (
                    <select
                      className="input-field"
                      value={newCandidate.strandId}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          strandId: e.target.value,
                          posId: "",
                        })
                      }
                      required
                    >
                      <option value="">Select Strand</option>
                      {strands.map((strand) => (
                        <option key={strand.id} value={strand.id}>
                          {strand.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    className="input-field"
                    value={newCandidate.posId}
                    onChange={(e) =>
                      setNewCandidate({
                        ...newCandidate,
                        posId: e.target.value,
                      })
                    }
                    required
                    disabled={candidatePositionOptions.length === 0}
                  >
                    <option value="">Target Position</option>
                    {candidatePositionOptions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {getPositionDisplayName(position, strands)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input-field"
                    placeholder="Political Alliance"
                    value={newCandidate.alliance}
                    onChange={(e) =>
                      setNewCandidate({
                        ...newCandidate,
                        alliance: e.target.value,
                      })
                    }
                  />
                  <button className="btn-primary w-full h-11">
                    <Plus className="w-4 h-4" /> Register Candidate
                  </button>
                </form>
                <div className="space-y-3 pt-6 border-t border-slate-50 max-h-72 overflow-y-auto pr-2 scrollbar-hidden">
                  {candidates.map((candidate) => {
                    const position = positions.find(
                      (entry) => entry.id === candidate.positionId,
                    );
                    return (
                      <div
                        key={candidate.id}
                        className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 group"
                      >
                        <div className="truncate">
                          <p className="text-[11px] font-black text-navy uppercase tracking-wide truncate">
                            {candidate.name}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {position
                              ? getPositionDisplayName(position, strands)
                              : candidate.positionId}{" "}
                            • {getCandidateAlliance(candidate)}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            await deleteDoc(
                              doc(db, "candidates", candidate.id),
                            );
                            addLog(
                              "CONFIG_DELETE",
                              `Deleted candidate ${candidate.name}`,
                            );
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card space-y-8 border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl text-gold">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                  Section Tally Progress
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-hidden">
                {sectionProgressRows.map(({ strand, strandSections }) => (
                  <div
                    key={strand.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-navy">
                        {strand.name}
                      </p>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {strandSections.length} sections
                      </span>
                    </div>
                    <div className="space-y-2">
                      {strandSections.map((section) => {
                        const submitted = sectionSubmissionSet.has(section.id);
                        return (
                          <div
                            key={section.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${submitted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-wide truncate">
                                {section.name}
                              </p>
                              <p className="text-[9px] font-bold uppercase tracking-widest">
                                {section.id}
                              </p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {submitted ? "Tally Submitted" : "Pending"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "LOGS" && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="card border-slate-200 shadow-sm"
          >
            <div className="flex items-center gap-4 border-b border-slate-100 pb-8 mb-8">
              <div className="p-2.5 bg-slate-50 rounded-xl text-navy">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-navy uppercase tracking-tight">
                  Audit Trail
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Immutable record of administrative operations
                </p>
              </div>
            </div>
            <div className="space-y-4 max-h-175 overflow-y-auto pr-4 scrollbar-hidden">
              {auditLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-300 space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
                  <History className="w-12 h-12 mx-auto opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">
                    No Audit Entries Recorded
                  </p>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-5 bg-white rounded-2xl border border-slate-100 flex items-start justify-between gap-8 hover:border-slate-200 transition-all shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${log.action.includes("INIT") ? "bg-amber-100 text-amber-700" : log.action.includes("DELETE") ? "bg-red-100 text-red-700" : "bg-navy text-white"}`}
                        >
                          {log.action}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 uppercase tracking-wide leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-slate-200 font-mono select-all">
                      ID:{log.id.slice(-6)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
