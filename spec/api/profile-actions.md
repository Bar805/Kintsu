# Profile Actions

## Purpose
Server actions for profile management: creation, updates, AI summary generation.

## Scope
- **In scope:** API contracts for profile CRUD operations
- **Out of scope:** Profile UI components, onboarding flow

## Dependencies
- [Profile](../data-models/profile.md) for data model
- [Conventions](../shared/conventions.md) for patterns

---

## updateProfile

### Signature
```typescript
async function updateProfile(
  profileData: Partial<Profile>
): Promise<{ success: boolean; error?: string }>
```

### Input
```typescript
Partial<Profile>  // Any subset of profile fields
```

### Output
```typescript
{
  success: boolean
  error?: string  // If success = false
}
```

### Business Rules
1. User can only update their own profile (RLS enforced)
2. `email` field immutable (tied to auth)
3. If `sliders` updated, all 5 required (social_battery, planning, conversation, thinking, risk)
4. If profile data changed, regenerate `ai_summary`

### File Location
`app/actions/profile.ts`

---

## generateAISummary

### Signature
```typescript
async function generateAISummary(
  profile: Profile
): Promise<string>
```

### Input
```typescript
Profile  // Full profile object
```

### Output
```typescript
string  // AI-generated summary (1-2 sentences)
```

### Business Rules
1. Use Gemini Flash for generation
2. Include: interests, bio, identity_chips, sliders in prompt
3. Output format: "Adventurous hiker who loves cooking and seeks deep conversations."
4. Max length: 200 characters

### File Location
`app/actions/profile.ts`

---

## Acceptance Criteria

- [ ] updateProfile verifies user owns profile (RLS)
- [ ] Email field cannot be changed
- [ ] Sliders validation enforces all 5 fields
- [ ] AI summary regenerated on profile changes
- [ ] generateAISummary uses Gemini Flash
