import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Award,
  Activity,
  Clock,
  Percent,
  TrendingUp,
  Vote,
} from "lucide-react";
import { Strand, Section, Position, Candidate, SectionTally } from "../types";
import {
  aggregateVotes,
  calculateCandidateMetrics,
  calculateGlobalAbstentions,
  calculateSchoolTurnout,
  calculateStrandTurnout,
  getPositionDisplayName,
  getSectionSubmissionStatus,
  rankAllianceResults,
} from "../utils";

interface LiveDashboardProps {
  strands: Strand[];
  sections: Section[];
  positions: Position[];
  candidates: Candidate[];
  tallies: SectionTally[];
}

export default function LiveDashboard({
  strands,
  sections,
  positions,
  candidates,
  tallies,
}: LiveDashboardProps) {
  const [activeTab, setActiveTab] = useState<"ASCO" | "STRANDS">("ASCO");
  const [selectedStrandId, setSelectedStrandId] = useState<string>(
    strands[0]?.id || "",
  );

  useEffect(() => {
    if (!selectedStrandId && strands[0]) {
      setSelectedStrandId(strands[0].id);
    }
  }, [selectedStrandId, strands]);

  const schoolTurnout = calculateSchoolTurnout(sections, tallies);
  const globalVotes = aggregateVotes(tallies);
  const globalValidVotes = useMemo(
    () => Object.values(globalVotes).reduce((sum, value) => sum + value, 0),
    [globalVotes],
  );
  const globalAbstentions = calculateGlobalAbstentions(tallies);
  const overallTurnoutPercent = schoolTurnout.percentage;

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
        .filter((position) => position.type === "STRAND")
        .sort((a, b) => a.order - b.order),
    [positions],
  );

  const sectionStatusCounts = useMemo(
    () =>
      sections.reduce(
        (accumulator, section) => {
          const tally = tallies.find((entry) => entry.sectionId === section.id);
          const status = getSectionSubmissionStatus(tally);
          accumulator[status] += 1;
          return accumulator;
        },
        { submitted: 0, partial: 0, pending: 0 },
      ),
    [sections, tallies],
  );

  const ascoAnalytics = useMemo(
    () =>
      ascoPositions.map((position) =>
        calculateCandidateMetrics(position, candidates, tallies, "ASCO"),
      ),
    [ascoPositions, candidates, tallies],
  );

  const strandAnalytics = useMemo(
    () =>
      strandPositions.map((position) =>
        calculateCandidateMetrics(
          position,
          candidates,
          tallies,
          "STRAND",
          selectedStrandId,
        ),
      ),
    [selectedStrandId, strandPositions, candidates, tallies],
  );

  const activeAnalytics =
    activeTab === "ASCO" ? ascoAnalytics : strandAnalytics;

  const turnoutData = [
    { name: "Voted", value: schoolTurnout.totalBallots },
    {
      name: "Remaining",
      value: Math.max(
        0,
        schoolTurnout.totalPopulation - schoolTurnout.totalBallots,
      ),
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy text-white px-3 py-2 rounded-lg shadow-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest">
          <p>{`${payload[0].name}: ${payload[0].value.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };

  const renderCandidateShareRows = (
    analytics: ReturnType<typeof calculateCandidateMetrics>,
    positionTotalVotes: number,
  ) =>
    analytics.candidates.map((candidate, index) => (
      <div
        key={candidate.id}
        className={`flex justify-between items-center p-4 rounded-xl transition-all border ${index === 0 ? "bg-navy text-white border-navy shadow-md" : "bg-white text-slate-900 border-slate-100 hover:border-slate-200"}`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <span
            className={`text-[12px] font-black w-8 h-8 flex items-center justify-center rounded-xl shadow-sm ${index === 0 ? "bg-gold text-navy" : "bg-slate-100 text-navy"}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p
              className={`text-xs font-black uppercase tracking-wide truncate ${index === 0 ? "text-white" : "text-navy"}`}
            >
              {candidate.name}
            </p>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest truncate ${index === 0 ? "text-white/60" : "text-slate-400"}`}
            >
              {candidate.alliance || candidate.party || "Independent"}
            </p>
          </div>
        </div>

        <div className="min-w-35 text-right space-y-2">
          <p
            className={`text-sm font-black font-mono ${index === 0 ? "text-gold" : "text-navy"}`}
          >
            {candidate.votes.toLocaleString()}
          </p>
          <p
            className={`text-[9px] font-black uppercase tracking-widest ${index === 0 ? "text-white/40" : "text-slate-300"}`}
          >
            Raw votes
          </p>
          <div
            className={`h-2 rounded-full overflow-hidden ${index === 0 ? "bg-white/10" : "bg-slate-100"}`}
          >
            <motion.div
              className={index === 0 ? "h-full bg-gold" : "h-full bg-navy"}
              initial={{ width: 0 }}
              animate={{
                width: `${(candidate.votes / positionTotalVotes) * 100}%`,
              }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <p
            className={`text-[9px] font-black uppercase tracking-widest ${index === 0 ? "text-white/40" : "text-slate-300"}`}
          >
            {candidate.validShare.toFixed(1)}% valid /{" "}
            {candidate.absoluteShare.toFixed(1)}% total
          </p>
        </div>
      </div>
    ));

  const renderPositionCard = (
    position: Position,
    analytics: ReturnType<typeof calculateCandidateMetrics>,
    mode: "ASCO" | "STRAND",
  ) => {
    const results = rankAllianceResults(
      position.id,
      candidates,
      globalVotes,
      mode === "STRAND" ? selectedStrandId : undefined,
    );
    const chartData = results.map((entry) => ({
      name: entry.alliance,
      votes: entry.votes,
    }));
    const positionTotalVotes = Math.max(1, analytics.totalVotesCast);
    const strandTurnout =
      mode === "STRAND" && selectedStrandId
        ? calculateStrandTurnout(selectedStrandId, sections, tallies)
        : null;

    return (
      <div
        key={position.id}
        className="card space-y-8 border-slate-200 shadow-sm"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-50 rounded-lg shrink-0">
              {mode === "ASCO" ? (
                <Award className="w-5 h-5 text-gold" />
              ) : (
                <TrendingUp className="w-5 h-5 text-gold" />
              )}
            </div>
            <h3 className="font-black text-navy text-lg uppercase tracking-tight truncate">
              {getPositionDisplayName(position, strands)}
            </h3>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100 shrink-0">
            {results.length} alliance{results.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Total
            </div>
            <div className="text-lg font-black text-navy font-mono">
              {analytics.totalVotesCast.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Valid
            </div>
            <div className="text-lg font-black text-navy font-mono">
              {analytics.totalValidVotes.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Abstain
            </div>
            <div className="text-lg font-black text-navy font-mono">
              {analytics.totalAbstentions.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Rate
            </div>
            <div className="text-lg font-black text-navy font-mono">
              {analytics.abstentionRate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Margin
            </div>
            <div className="text-lg font-black text-navy font-mono">
              {analytics.winningMargin.toLocaleString()}
            </div>
          </div>
        </div>

        {strandTurnout && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              <span>{strandTurnout.totalBallots.toLocaleString()} ballots</span>
              <span>{strandTurnout.percentage.toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
              <motion.div
                className="h-full bg-navy"
                initial={{ width: 0 }}
                animate={{ width: `${strandTurnout.percentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {results.length > 0 ? (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 20, right: 30 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{
                      fontSize: 10,
                      fontWeight: 800,
                      fill: "#64748b",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="votes" radius={[0, 6, 6, 0]} barSize={32}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`${position.id}-${entry.name}-${index}`}
                        fill={index === 0 ? "#FFD700" : "#002147"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4 pt-2">
              {renderCandidateShareRows(analytics, positionTotalVotes)}
            </div>
          </>
        ) : (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-4 border-2 border-dashed border-slate-100 rounded-2xl">
            <Vote className="w-10 h-10 opacity-20" />
            <p className="font-black uppercase text-[10px] tracking-[0.3em]">
              No Candidates Logged
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between px-6 py-3 bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Live Stream
            </span>
          </div>
          <span className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" />
            Synchronized: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-navy animate-pulse" />
          <span className="text-[9px] font-black text-navy uppercase tracking-[0.2em]">
            Firestore Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card bg-navy text-white overflow-hidden relative border-none">
          <div className="absolute right-0 top-0 w-96 h-96 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="w-56 h-56 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={turnoutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#FFD700" stroke="none" />
                    <Cell fill="rgba(255,255,255,0.08)" stroke="none" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-gold">
                  {overallTurnoutPercent.toFixed(1)}%
                </span>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                  Turnout
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-6 text-center md:text-left">
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tight leading-tight">
                  SHS Participation
                </h2>
                <p className="text-white/50 text-sm font-medium mt-2 max-w-md">
                  Real-time paper ballot aggregation stream for senior
                  highschool student elections.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                    Total Ballots Cast
                  </div>
                  <div className="text-3xl font-black font-mono tracking-tighter">
                    {schoolTurnout.totalBallots.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                    Registered Voters
                  </div>
                  <div className="text-3xl font-black font-mono tracking-tighter">
                    {schoolTurnout.totalPopulation.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                  <span>Overall Turnout</span>
                  <span>{overallTurnoutPercent.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden border border-white/10">
                  <motion.div
                    className="h-full bg-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallTurnoutPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card space-y-6 border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-4 h-4 text-navy" />
            <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
              Strand Breakdown
            </h3>
          </div>
          <div className="space-y-5">
            {strands.map((strand) => {
              const turnout = calculateStrandTurnout(
                strand.id,
                sections,
                tallies,
              );
              return (
                <div key={strand.id} className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className="text-slate-600">{strand.name}</span>
                    <span className="text-navy">
                      {turnout.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-navy"
                      initial={{ width: 0 }}
                      animate={{ width: `${turnout.percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="card border-slate-200 shadow-xs space-y-2">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Turnout
          </div>
          <div className="text-2xl font-black text-navy font-mono">
            {schoolTurnout.totalBallots.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            of {schoolTurnout.totalPopulation.toLocaleString()} voters
          </div>
        </div>
        <div className="card border-slate-200 shadow-xs space-y-2">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Turnout Rate
          </div>
          <div className="text-2xl font-black text-navy font-mono">
            {overallTurnoutPercent.toFixed(1)}%
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            school-wide
          </div>
        </div>
        <div className="card border-slate-200 shadow-xs space-y-2">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Abstentions
          </div>
          <div className="text-2xl font-black text-navy font-mono">
            {globalAbstentions.totalAbstains.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {globalAbstentions.abstentionRate.toFixed(1)}% of recorded votes
          </div>
        </div>
        <div className="card border-slate-200 shadow-xs space-y-2">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Sections
          </div>
          <div className="text-2xl font-black text-navy font-mono">
            {sectionStatusCounts.submitted}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            complete / {sectionStatusCounts.partial} partial /{" "}
            {sectionStatusCounts.pending} pending
          </div>
        </div>
        <div className="card border-slate-200 shadow-xs space-y-2">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Valid Votes
          </div>
          <div className="text-2xl font-black text-navy font-mono">
            {globalValidVotes.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            candidate totals only
          </div>
        </div>
        <div className="card border-slate-200 shadow-xs space-y-2">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Total Recorded
          </div>
          <div className="text-2xl font-black text-navy font-mono">
            {(
              globalValidVotes + globalAbstentions.totalAbstains
            ).toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            votes + abstentions
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xs w-fit">
        <button
          onClick={() => setActiveTab("ASCO")}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === "ASCO"
              ? "bg-navy text-white shadow-lg"
              : "text-slate-400 hover:text-navy hover:bg-slate-50"
          }`}
        >
          ASCO Results
        </button>
        <button
          onClick={() => setActiveTab("STRANDS")}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === "STRANDS"
              ? "bg-navy text-white shadow-lg"
              : "text-slate-400 hover:text-navy hover:bg-slate-50"
          }`}
        >
          Strand Reps
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "ASCO" ? (
          <motion.div
            key="asco"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {ascoPositions.map((position, index) =>
              renderPositionCard(position, ascoAnalytics[index], "ASCO"),
            )}
          </motion.div>
        ) : (
          <motion.div
            key="strands"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div className="flex flex-wrap gap-3 p-2 bg-white rounded-2xl border border-slate-200 shadow-xs w-fit">
              {strands.map((strand) => (
                <button
                  key={strand.id}
                  onClick={() => setSelectedStrandId(strand.id)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${
                    selectedStrandId === strand.id
                      ? "bg-gold text-navy shadow-md"
                      : "text-slate-400 hover:text-navy hover:bg-slate-50"
                  }`}
                >
                  {strand.name}
                </button>
              ))}
            </div>

            {selectedStrandId && activeAnalytics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {strandPositions.map((position, index) =>
                  renderPositionCard(
                    position,
                    strandAnalytics[index],
                    "STRAND",
                  ),
                )}
              </div>
            )}

            {selectedStrandId && activeAnalytics.length === 0 && (
              <div className="card shadow-sm h-72 flex flex-col items-center justify-center text-slate-400 gap-4 border-2 border-dashed border-slate-100 rounded-2xl">
                <Vote className="w-10 h-10 opacity-20" />
                <p className="font-black uppercase text-[10px] tracking-[0.3em]">
                  No Strand Candidates Logged
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
