import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const params = new URL(request.url).searchParams;
    const institutionId = params.get("institutionId");
    const month = params.get("month");

    if (!institutionId) {
      return new Response(superjson.stringify({ message: "Муассисаро интихоб кунед." }), { status: 400 });
    }
    if (month && !/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(month)) {
      return new Response(superjson.stringify({ message: "Моҳ бояд дар шакли YYYY-MM бошад." }), { status: 400 });
    }

    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();

    if (user.role !== "admin" && !access) {
      return new Response(superjson.stringify({ message: "Иҷозат надоред." }), { status: 403 });
    }

    let query = db.selectFrom("institutionPayrollEntries")
      .innerJoin("institutionStaff", "institutionStaff.id", "institutionPayrollEntries.staffId")
      .leftJoin("institutionTariffs", "institutionTariffs.id", "institutionPayrollEntries.tariffId")
      .select([
        "institutionPayrollEntries.id",
        "institutionPayrollEntries.staffId",
        "institutionPayrollEntries.payrollMonth",
        "institutionPayrollEntries.baseAmount",
        "institutionPayrollEntries.allowances",
        "institutionPayrollEntries.classHeadAllowance",
        "institutionPayrollEntries.notebookCheckingAllowance",
        "institutionPayrollEntries.methodicalAssociationHeadAllowance",
        "institutionPayrollEntries.otherAllowances",
        "institutionPayrollEntries.grossAmount",
        "institutionPayrollEntries.deductions",
        "institutionPayrollEntries.incomeTaxDeduction",
        "institutionPayrollEntries.partyDuesDeduction",
        "institutionPayrollEntries.tradeUnionDuesDeduction",
        "institutionPayrollEntries.newspaperDeduction",
        "institutionPayrollEntries.otherDeductions",
        "institutionPayrollEntries.netAmount",
        "institutionPayrollEntries.workRate",
        "institutionPayrollEntries.weeklyHours",
        "institutionPayrollEntries.workingDays",
        "institutionPayrollEntries.notes",
        "institutionPayrollEntries.financeRuleSnapshot",
        "institutionStaff.fullName",
        "institutionStaff.positionTitle",
        "institutionTariffs.qualificationCategory",
      ])
      .where("institutionPayrollEntries.institutionId", "=", institutionId);

    if (month) {
      query = query.where("institutionPayrollEntries.payrollMonth", "=", new Date(`${month}-01T00:00:00.000Z`));
    }

    const entries = await query.orderBy("institutionStaff.fullName").execute();
    return new Response(superjson.stringify({ entries }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({
      message: status === 401 ? "Барои дидани табели маош ворид шавед." : "Табели маош дастрас нест.",
    }), { status, headers: { "Content-Type": "application/json" } });
  }
}
