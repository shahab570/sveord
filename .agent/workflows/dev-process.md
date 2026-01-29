# Standard Development Process

To maintain a stable development environment and avoid "Port already in use" errors or Supabase mismatch issues, follow this standard process:

## 1. Localhost Management
- **Primary Server**: The USER should always be the one running `npm run dev` in their own terminal.
- **Fixed Port**: The project is locked to port **8081** (`strictPort: true` in `vite.config.ts`).
- **Supabase Config**: Always use `http://localhost:8081` in your Supabase authentication settings.

## 2. Agent (AntiGravity) Interaction
- I will generally **NOT** run long-running background servers.
- If I need to perform an automated browser verification:
  1. I will check if port 8081 is active.
  2. If it is already running (by you), I will use that existing server for my tests.
  3. If I must start my own server, I will notify you and terminate it immediately after the test is complete.

## 3. Resolving Conflicts
If you see "Port 8081 is already in use":
- It usually means an old process is still hanging.
- You can run this command to find and kill it:
  ```powershell
  # Find PID
  netstat -ano | findstr :8081
  # Kill PID (replace <PID> with the number from the last column)
  taskkill /F /PID <PID>
  ```

Following this ensures we are always looking at the same version of the code without breaking the Supabase connection.
