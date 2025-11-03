# Authorization & Access Control

EFIR implements role-based access control (RBAC) for admin routes and future admin features.

## Overview

- **Public Routes**: Most pages are accessible to all authenticated users
- **Admin Routes**: Protected by middleware, requires admin role
- **RLS**: Database-level security ensures users only access their own data

## Admin Access Control

### Middleware Protection

All routes under `/admin` are protected by `middleware.ts`:

1. **Authentication Check**: If not logged in → redirect to `/login`
2. **Authorization Check**: If logged in but not admin → redirect to `/forbidden`
3. **Admin Access**: If admin → allow access

### Admin Detection

The `isAdmin()` function checks multiple sources (in order):

1. **Environment Variable** (`ADMIN_EMAILS`):
   ```bash
   # .env.local or Vercel environment variables
   ADMIN_EMAILS=admin@example.com,super@example.com
   ```
   - Comma-separated list of admin email addresses
   - Case-insensitive matching
   - Recommended for production

2. **User Metadata Role** (`user_metadata.role`):
   ```typescript
   // Set via Supabase Auth admin API or dashboard
   user_metadata: { role: 'admin' }
   ```

3. **User Metadata Flag** (`user_metadata.isAdmin`):
   ```typescript
   // Set via Supabase Auth admin API or dashboard
   user_metadata: { isAdmin: true }
   ```

### Setting Admin Role

#### Option 1: Environment Variable (Recommended)

Add to `.env.local` or Vercel environment variables:

```bash
ADMIN_EMAILS=admin@example.com,super@example.com
```

**Pros**:
- Easy to manage
- No database changes needed
- Works immediately
- Can be updated without code changes

**Cons**:
- Requires deployment to update
- Not stored in user profile

#### Option 2: User Metadata (Supabase Dashboard)

1. Go to Supabase Dashboard → Authentication → Users
2. Select user
3. Edit user metadata:
   ```json
   {
     "role": "admin"
   }
   ```
   Or:
   ```json
   {
     "isAdmin": true
   }
   ```

**Pros**:
- Per-user control
- Can be updated via API
- Stored in user profile

**Cons**:
- Requires Supabase access
- Manual setup per user

#### Option 3: Programmatic (Supabase Admin API)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Update user metadata
await supabase.auth.admin.updateUserById(userId, {
  user_metadata: { role: 'admin' }
});
```

## Protected Routes

### Current Admin Routes

- `/admin` - Admin settings page

### Adding New Admin Routes

Routes starting with `/admin` are automatically protected:

```typescript
// app/admin/users/page.tsx - Automatically protected
export default function AdminUsersPage() {
  // Only accessible to admins
}
```

For non-admin routes that need protection:

```typescript
// app/api/admin/.../route.ts
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Admin-only logic
}
```

## Middleware Implementation

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Check auth
  const { user } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect('/login');
  }

  // Check admin
  if (!isAdmin(user)) {
    return NextResponse.redirect('/forbidden');
  }

  return NextResponse.next();
}
```

## Error Pages

### 403 Forbidden (`/forbidden`)

Displayed when:
- User is authenticated but not admin
- User tries to access admin routes

**User Experience**:
- Clear error message
- Links to home and login
- No sensitive information exposed

### Login Redirect

When unauthenticated users try to access `/admin`:
- Redirected to `/login`
- `redirect` query parameter set for post-login navigation

## Testing Admin Access

### Local Development

1. **Set admin emails**:
   ```bash
   # .env.local
   ADMIN_EMAILS=your-email@example.com
   ```

2. **Login with admin email**:
   ```bash
   # Visit /login
   # Use email that matches ADMIN_EMAILS
   ```

3. **Verify access**:
   - Visit `/admin` → Should see admin page
   - Logout → Visit `/admin` → Should redirect to `/login`
   - Login with non-admin email → Should redirect to `/forbidden`

### Production

1. **Set environment variable**:
   ```bash
   # Vercel Dashboard → Settings → Environment Variables
   ADMIN_EMAILS=admin1@example.com,admin2@example.com
   ```

2. **Or use user metadata**:
   - Set `user_metadata.role = 'admin'` in Supabase

## Best Practices

### ✅ DO

- Use environment variables for production admin emails
- Test admin access in staging before production
- Document who has admin access
- Use user metadata for dynamic admin assignment
- Protect API routes that modify admin settings

### ❌ DON'T

- Hardcode admin emails in code
- Expose admin logic to client-side
- Skip authorization checks in API routes
- Store admin flags in client-accessible data
- Grant admin access to test users in production

## Security Considerations

1. **Middleware Protection**: First line of defense, runs before page render
2. **Server-Side Checks**: API routes should also verify admin status
3. **Environment Variables**: Never commit `.env.local` to git
4. **User Metadata**: Can be updated via Supabase API (requires service key)
5. **Rate Limiting**: Consider rate limiting admin routes in production

## Related Documentation

- [Security (RLS)](./security.md) - Database-level security
- [Deployment](./deploy.md) - Environment variable setup
- [API Validation](./validation.md) - Input validation

## Troubleshooting

### "Redirected to /forbidden"

- Check `ADMIN_EMAILS` environment variable matches your email
- Verify user metadata in Supabase dashboard
- Check email case sensitivity (emails are compared lowercase)

### "Redirected to /login"

- User is not authenticated
- Session may have expired
- Clear cookies and login again

### Admin Access Not Working

1. **Check environment variable**:
   ```bash
   echo $ADMIN_EMAILS
   ```

2. **Check user metadata**:
   ```sql
   SELECT email, raw_user_meta_data
   FROM auth.users
   WHERE email = 'your-email@example.com';
   ```

3. **Restart dev server**:
   ```bash
   npm run dev
   ```

4. **Check middleware logs**:
   - Add console.log in middleware for debugging

