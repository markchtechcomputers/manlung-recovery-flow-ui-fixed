const express = require('express');
const router = express.Router();

const { adminAuth } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const FINISHED_STATUSES = new Set([
  'Recovery Successful',
  'Recovered by Police',
  'Recovered by Owner',
  'Closed',
  'Rejected',
]);

const SUCCESS_STATUSES = new Set([
  'Recovery Successful',
  'Recovered by Police',
  'Recovered by Owner',
]);

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthKey(value) {
  return new Date(value).toISOString().slice(0, 7);
}

function hoursBetween(start, end) {
  if (!start || !end) return null;

  const a = new Date(start).getTime();
  const b = new Date(end).getTime();

  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return null;
  }

  return (b - a) / 3600000;
}

router.get('/operations', adminAuth, async (req, res) => {
  try {
    const now = new Date();

    const requestedDate =
      String(req.query?.date || '').trim();

    const requestedMode =
      ['today', 'week', 'month', 'date'].includes(
        String(req.query?.mode || '')
      )
        ? String(req.query.mode)
        : 'today';

    const selectedDate =
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
        ? requestedDate
        : dayKey(now);

    const selectedDateStart =
      new Date(`${selectedDate}T00:00:00`);

    const selectedDateEnd =
      new Date(
        selectedDateStart.getTime() +
        24 * 60 * 60 * 1000 - 1
      );

    const todayKey = dayKey(now);
    const currentMonth = monthKey(now);

    const start14 = new Date(now);
    start14.setHours(0, 0, 0, 0);
    start14.setDate(start14.getDate() - 13);

    const startMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const [
      adminsResult,
      casesResult,
      callsResult,
    ] = await Promise.all([
      supabase
        .from('recovery_users')
        .select('id, username, email, role, admin_status, created_at')
        .in('role', ['admin', 'owner'])
        .order('created_at', { ascending: true }),

      supabase
        .from('recovery_cases')
        .select(
          'case_id, assigned_admin_id, completed_by, status, created_at, started_at, completed_at'
        )
        .order('created_at', { ascending: true }),

      supabase
        .from('recovery_call_sessions')
        .select(
          'id, admin_user_id, status, created_at, accepted_at, ended_at'
        )
        .order('created_at', { ascending: true }),
    ]);

    if (adminsResult.error) throw adminsResult.error;
    if (casesResult.error) throw casesResult.error;
    if (callsResult.error) throw callsResult.error;

    const admins = adminsResult.data || [];
    const cases = casesResult.data || [];
    const calls = callsResult.data || [];

    const adminMap = new Map(
      admins.map(admin => [
        String(admin.id),
        {
          ...admin,
          name: admin.username || admin.email || 'Admin',
        },
      ])
    );

    const teamMembers = admins.map(admin => ({
      id: String(admin.id),
      name: admin.username || admin.email || 'Admin',
      email: admin.email || '',
      role: admin.role,
      adminStatus: admin.admin_status || 'active',
      active:
        admin.role === 'owner' ||
        admin.admin_status === 'active',
      callsAnswered: 0,
      casesAssigned: 0,
      casesCompleted: 0,
      successfulCases: 0,
      averageResolutionHours: null,
      callSharePercent: 0,
      caseSharePercent: 0,
      completionPercent: 0,
      successPercent: 0,
      activityPercent: 0,
      resolutionSamples: [],
    }));

    const memberMap = new Map(
      teamMembers.map(member => [String(member.id), member])
    );

    const todayCases = cases.filter(
      item => item.created_at && dayKey(item.created_at) === todayKey
    );

    const monthCases = cases.filter(
      item =>
        item.created_at &&
        monthKey(item.created_at) === currentMonth
    );

    const openCases = cases.filter(
      item => !FINISHED_STATUSES.has(item.status)
    );

    const completedCases = cases.filter(
      item => FINISHED_STATUSES.has(item.status)
    );

    const successfulCases = cases.filter(
      item => SUCCESS_STATUSES.has(item.status)
    );

    const monthAnsweredCalls = calls.filter(
      item =>
        item.accepted_at &&
        monthKey(item.accepted_at) === currentMonth
    );

    const todayAnsweredCalls = calls.filter(
      item =>
        item.accepted_at &&
        dayKey(item.accepted_at) === todayKey
    );

    const resolutionSamples = completedCases
      .map(item =>
        hoursBetween(item.created_at, item.completed_at)
      )
      .filter(value => value !== null);

    const averageResolutionHours =
      resolutionSamples.length
        ? resolutionSamples.reduce((a, b) => a + b, 0) /
          resolutionSamples.length
        : null;

    let totalAssigned = 0;

    for (const item of cases) {
      if (!item.assigned_admin_id) continue;

      const member =
        memberMap.get(String(item.assigned_admin_id));

      if (!member) continue;

      member.casesAssigned += 1;
      totalAssigned += 1;

      if (FINISHED_STATUSES.has(item.status)) {
        member.casesCompleted += 1;
      }

      if (SUCCESS_STATUSES.has(item.status)) {
        member.successfulCases += 1;
      }

      const resolution =
        hoursBetween(
          item.created_at,
          item.completed_at
        );

      if (resolution !== null) {
        member.resolutionSamples.push(resolution);
      }
    }

    let totalAnsweredCalls = 0;

    for (const call of calls) {
      if (!call.accepted_at || !call.admin_user_id) {
        continue;
      }

      const member =
        memberMap.get(String(call.admin_user_id));

      if (!member) continue;

      member.callsAnswered += 1;
      totalAnsweredCalls += 1;
    }

    for (const member of teamMembers) {
      const samples = member.resolutionSamples;

      member.averageResolutionHours =
        samples.length
          ? samples.reduce((a, b) => a + b, 0) /
            samples.length
          : null;

      member.callSharePercent =
        totalAnsweredCalls
          ? (member.callsAnswered / totalAnsweredCalls) * 100
          : 0;

      member.caseSharePercent =
        totalAssigned
          ? (member.casesAssigned / totalAssigned) * 100
          : 0;

      member.completionPercent =
        member.casesAssigned
          ? (member.casesCompleted / member.casesAssigned) * 100
          : 0;

      member.successPercent =
        member.casesCompleted
          ? (member.successfulCases / member.casesCompleted) * 100
          : 0;

      /*
       * Activity percentage is descriptive, not a subjective
       * employee score. It combines share of team calls and cases.
       */
      member.activityPercent =
        Math.min(
          100,
          (member.callSharePercent * 0.4) +
          (member.caseSharePercent * 0.6)
        );

      delete member.resolutionSamples;
    }

    const dailyMap = new Map();

    for (let i = 0; i < 14; i++) {
      const date = new Date(start14);
      date.setDate(start14.getDate() + i);

      dailyMap.set(
        dayKey(date),
        {
          date: dayKey(date),
          submitted: 0,
          completed: 0,
        }
      );
    }

    for (const item of cases) {
      if (!item.created_at) continue;

      const key = dayKey(item.created_at);

      if (dailyMap.has(key)) {
        dailyMap.get(key).submitted += 1;
      }

      if (
        item.completed_at &&
        dailyMap.has(dayKey(item.completed_at))
      ) {
        dailyMap.get(dayKey(item.completed_at)).completed += 1;
      }
    }


    // --------------------------------------------------------
    // SELECTED DATE + ROLLING 7-DAY REPORT
    // --------------------------------------------------------
    let periodStart =
      new Date(selectedDateStart);

    let periodEnd =
      new Date(selectedDateEnd);

    if (requestedMode === 'week') {
      periodStart = new Date(
        selectedDateStart
      );

      periodStart.setDate(
        periodStart.getDate() - 6
      );
    }

    if (requestedMode === 'month') {
      periodStart = new Date(
        selectedDateStart.getFullYear(),
        selectedDateStart.getMonth(),
        1
      );

      periodEnd = new Date(
        selectedDateStart.getFullYear(),
        selectedDateStart.getMonth() + 1,
        1
      );

      periodEnd.setMilliseconds(
        periodEnd.getMilliseconds() - 1
      );
    }

    const periodCases =
      cases.filter(item => {
        if (!item.created_at) return false;

        const created =
          new Date(item.created_at);

        return (
          created >= periodStart &&
          created <= periodEnd
        );
      });

    const periodCompleted =
      cases.filter(item => {
        if (!item.completed_at) return false;

        const completed =
          new Date(item.completed_at);

        return (
          completed >= periodStart &&
          completed <= periodEnd &&
          FINISHED_STATUSES.has(item.status)
        );
      });

    const periodCalls =
      calls.filter(item => {
        if (!item.accepted_at) return false;

        const accepted =
          new Date(item.accepted_at);

        return (
          accepted >= periodStart &&
          accepted <= periodEnd
        );
      });

    const rollingWeekStart =
      new Date(selectedDateStart);

    rollingWeekStart.setDate(
      rollingWeekStart.getDate() - 6
    );

    const weeklyCallFlow = [];

    for (let i = 0; i < 7; i++) {
      const date =
        new Date(rollingWeekStart);

      date.setDate(
        rollingWeekStart.getDate() + i
      );

      const key =
        dayKey(date);

      weeklyCallFlow.push({
        date: key,
        calls: calls.filter(item =>
          item.accepted_at &&
          dayKey(item.accepted_at) === key
        ).length,
        cases: cases.filter(item =>
          item.created_at &&
          dayKey(item.created_at) === key
        ).length,
        completed: cases.filter(item =>
          item.completed_at &&
          dayKey(item.completed_at) === key &&
          FINISHED_STATUSES.has(item.status)
        ).length,
      });
    }

    const selectedDateAdminReport =
      buildAdminPeriodReport(
        selectedDateStart,
        selectedDateEnd
      );


    const statusCounts = {};

    for (const item of monthCases) {
      const status =
        item.status || 'Unknown';

      statusCounts[status] =
        (statusCounts[status] || 0) + 1;
    }


    // --------------------------------------------------------
    // DAILY / WEEKLY / ALL-TIME ADMIN REPORTS
    // --------------------------------------------------------
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);

    const startWeek = new Date(startToday);
    startWeek.setDate(
      startToday.getDate() - 6
    );

    function buildAdminPeriodReport(
      startDate,
      endDate = now
    ) {
      const report = new Map(
        teamMembers.map(member => [
          String(member.id),
          {
            id: String(member.id),
            name: member.name,
            role: member.role,
            active: member.active,
            casesHandled: 0,
            casesCompleted: 0,
            callsAnswered: 0,
          }
        ])
      );

      for (const item of cases) {
        if (!item.assigned_admin_id) continue;
        if (!item.created_at) continue;

        const created = new Date(
          item.created_at
        );

        if (
          created < startDate ||
          created > endDate
        ) {
          continue;
        }

        const member =
          report.get(
            String(item.assigned_admin_id)
          );

        if (!member) continue;

        member.casesHandled += 1;

        if (
          FINISHED_STATUSES.has(
            item.status
          )
        ) {
          member.casesCompleted += 1;
        }
      }

      for (const call of calls) {
        if (!call.accepted_at) continue;
        if (!call.admin_user_id) continue;

        const accepted =
          new Date(call.accepted_at);

        if (
          accepted < startDate ||
          accepted > endDate
        ) {
          continue;
        }

        const member =
          report.get(
            String(call.admin_user_id)
          );

        if (!member) continue;

        member.callsAnswered += 1;
      }

      const rows =
        [...report.values()];

      const totalCases =
        rows.reduce(
          (sum, row) =>
            sum + row.casesHandled,
          0
        );

      const totalCompleted =
        rows.reduce(
          (sum, row) =>
            sum + row.casesCompleted,
          0
        );

      const totalCalls =
        rows.reduce(
          (sum, row) =>
            sum + row.callsAnswered,
          0
        );

      rows.sort((a, b) => {
        if (
          b.casesHandled !==
          a.casesHandled
        ) {
          return (
            b.casesHandled -
            a.casesHandled
          );
        }

        if (
          b.casesCompleted !==
          a.casesCompleted
        ) {
          return (
            b.casesCompleted -
            a.casesCompleted
          );
        }

        return (
          b.callsAnswered -
          a.callsAnswered
        );
      });

      rows.forEach((row, index) => {
        row.rank = index + 1;

        row.caseSharePercent =
          totalCases
            ? Number(
                (
                  row.casesHandled /
                  totalCases *
                  100
                ).toFixed(1)
              )
            : 0;

        row.completionPercent =
          row.casesHandled
            ? Number(
                (
                  row.casesCompleted /
                  row.casesHandled *
                  100
                ).toFixed(1)
              )
            : 0;

        row.callSharePercent =
          totalCalls
            ? Number(
                (
                  row.callsAnswered /
                  totalCalls *
                  100
                ).toFixed(1)
              )
            : 0;
      });

      return {
        totals: {
          casesHandled: totalCases,
          casesCompleted: totalCompleted,
          callsAnswered: totalCalls,
        },
        admins: rows,
      };
    }

    const endToday = new Date(now);

    const dailyAdminReport =
      buildAdminPeriodReport(
        startToday,
        endToday
      );

    const weeklyAdminReport =
      buildAdminPeriodReport(
        startWeek,
        endToday
      );

    const allTimeStart =
      new Date(1970, 0, 1);

    const allTimeAdminReport =
      buildAdminPeriodReport(
        allTimeStart,
        endToday
      );

    const monthlyCallDistribution =
      teamMembers
        .map(member => ({
          adminId: member.id,
          name: member.name,
          callsAnswered: member.callsAnswered,
          percentage: Number(
            member.callSharePercent.toFixed(1)
          ),
        }))
        .filter(item => item.callsAnswered > 0)
        .sort(
          (a, b) =>
            b.callsAnswered - a.callsAnswered
        );

    const topCallAdmin =
      monthlyCallDistribution[0] || null;

    // --------------------------------------------------------
    // MONTHLY ADMIN WORK COVERAGE
    // Transparent workload distribution for the current month.
    // Work units = assigned cases + answered calls.
    // --------------------------------------------------------
    const monthlyMembers =
      teamMembers.map(member => {
        const monthlyCases =
          monthCases.filter(
            item =>
              String(item.assigned_admin_id) ===
              String(member.id)
          ).length;

        const monthlyCompleted =
          monthCases.filter(
            item =>
              String(item.assigned_admin_id) ===
                String(member.id) &&
              FINISHED_STATUSES.has(item.status)
          ).length;

        const monthlyCalls =
          monthAnsweredCalls.filter(
            call =>
              String(call.admin_user_id) ===
              String(member.id)
          ).length;

        return {
          id: String(member.id),
          name: member.name,
          role: member.role,
          active: member.active,
          casesHandled: monthlyCases,
          casesCompleted: monthlyCompleted,
          callsAnswered: monthlyCalls,
          workUnits:
            monthlyCases + monthlyCalls,
          caseSharePercent:
            monthCases.length
              ? Number(
                  (
                    monthlyCases /
                    monthCases.length *
                    100
                  ).toFixed(1)
                )
              : 0,
          callSharePercent:
            monthAnsweredCalls.length
              ? Number(
                  (
                    monthlyCalls /
                    monthAnsweredCalls.length *
                    100
                  ).toFixed(1)
                )
              : 0,
        };
      });

    const monthlyWorkUnits =
      monthlyMembers.reduce(
        (sum, member) =>
          sum + member.workUnits,
        0
      );

    monthlyMembers.forEach(member => {
      member.workSharePercent =
        monthlyWorkUnits
          ? Number(
              (
                member.workUnits /
                monthlyWorkUnits *
                100
              ).toFixed(1)
            )
          : 0;
    });

    monthlyMembers.sort(
      (a, b) =>
        b.workUnits - a.workUnits ||
        b.casesCompleted - a.casesCompleted ||
        b.callsAnswered - a.callsAnswered
    );

    monthlyMembers.forEach(
      (member, index) => {
        member.rank = index + 1;
      }
    );

    const currentMonthLabel =
      now.toLocaleDateString(
        undefined,
        {
          month: 'long',
          year: 'numeric'
        }
      );

    res.json({
      success: true,

      generatedAt: now.toISOString(),

      company: {
        casesToday: todayCases.length,
        casesThisMonth: monthCases.length,
        openCases: openCases.length,
        completedCases: completedCases.length,
        successfulCases: successfulCases.length,
        successRate:
          completedCases.length
            ? Number(
                (
                  (successfulCases.length /
                    completedCases.length) *
                  100
                ).toFixed(1)
              )
            : 0,
        callsAnsweredToday:
          todayAnsweredCalls.length,
        callsAnsweredThisMonth:
          monthAnsweredCalls.length,
        averageResolutionHours:
          averageResolutionHours === null
            ? null
            : Number(
                averageResolutionHours.toFixed(1)
              ),
        activeAdmins:
          teamMembers.filter(
            member =>
              member.role === 'owner' ||
              member.adminStatus === 'active'
          ).length,
        totalAdmins:
          teamMembers.filter(
            member => member.role === 'admin'
          ).length,
      },

      dailyFlow: [...dailyMap.values()],

      selectedDate: selectedDate,

      selectedDateReport: {
        mode: requestedMode,
        startDate: dayKey(periodStart),
        endDate: dayKey(periodEnd),
        cases: periodCases.length,
        completed: periodCompleted.length,
        calls: periodCalls.length,
        adminReport: selectedDateAdminReport,
      },

      weeklyFlow: weeklyCallFlow,

      monthlyStatusCounts: statusCounts,

      monthlyCallDistribution,

      topCallAdmin,

      currentMonthLabel,

      monthlyWorkCoverage:
        monthlyMembers,

      dailyAdminReport,
      weeklyAdminReport,
      allTimeAdminReport,

      admins: teamMembers.sort((a, b) => {
        if (b.callsAnswered !== a.callsAnswered) {
          return b.callsAnswered - a.callsAnswered;
        }

        return (
          b.casesAssigned -
          a.casesAssigned
        );
      }),
    });
  } catch (error) {
    console.error(
      'Operations analytics error:',
      error
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        'Could not load operations analytics.',
    });
  }
});

module.exports = router;
