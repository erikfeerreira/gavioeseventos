<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Participant data is never readable by anonymous users; public sign-up, confirmation lookup and check-in go through security-definer DB functions (register_for_event, get_registration_confirmation, confirm_checkin) so validation and authorization live in the database.
- Team permissions come from the user_roles table (admin/staff/checkin) checked via has_role/is_team/is_manager in RLS; the UI only hides controls.
- Event content (texts, rules, activities, FAQ, partners, consent) is stored per event in the events table, never hardcoded, so new events need no code changes.
