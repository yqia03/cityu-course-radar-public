import { getUser, googleEnabled } from "@/lib/auth";
import { json, failure, readVisitor, withVisitor } from "@/lib/http";
import { adminIds } from "@/lib/db";
export async function GET(request: Request) {
  try {
    const user = await getUser(),
      v = await readVisitor(request);
    const response = json({
      canReview: !!v,
      googleEnabled: googleEnabled(),
      user: user
        ? {
            id: user.userId,
            accountId: user.accountId,
            balance: user.balance,
            displayName: user.fullName || "CityU community member",
            isAdmin: adminIds().includes(user.userId),
          }
        : null,
    });
    return v ? withVisitor(response, request, v.token) : response;
  } catch (e) {
    return failure(e);
  }
}
