/* smartPDF-open.exe —— 在电脑里双击 PDF 时先跑这个小程序（没有窗口，一闪都不会）。
   smartPDF 已经开着：把文件交给它（开在新标签），把它的窗口叫到最前面，自己退出。
   没开着：照常启动 smartPDF.exe。
   一次选好几个 PDF 按 Enter（Windows 会同时启动好几个）：排队，第一个开好窗口后，其余的都交给它。
   编译：x86_64-w64-mingw32-gcc -O2 -municode -mwindows launcher.c -o smartPDF-open.exe -lshell32 */
#define WIN32_LEAN_AND_MEAN
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <shellapi.h>
#include <wchar.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static WCHAR g_temp[MAX_PATH], g_live[MAX_PATH], g_inbox[MAX_PATH];

static long long now_ms(void) {
  FILETIME ft; GetSystemTimeAsFileTime(&ft);
  ULARGE_INTEGER u; u.LowPart = ft.dwLowDateTime; u.HighPart = ft.dwHighDateTime;
  return (long long)((u.QuadPart - 116444736000000000ULL) / 10000ULL);
}

static int pid_alive(DWORD pid) {
  HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!h) return GetLastError() == ERROR_ACCESS_DENIED; /* 有这个进程但看不了 */
  DWORD code = 0; int ok = GetExitCodeProcess(h, &code) && code == STILL_ACTIVE;
  CloseHandle(h); return ok;
}

/* 读「我还在」记录：第一行 "pid 毫秒"，第二行窗口标题。新鲜（6 秒内）且进程还在才算 */
static int read_live(DWORD *pid, WCHAR *title, int tcap) {
  HANDLE h = CreateFileW(g_live, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL, OPEN_EXISTING, 0, NULL);
  if (h == INVALID_HANDLE_VALUE) return 0;
  char buf[4096]; DWORD n = 0; int r = ReadFile(h, buf, sizeof buf - 1, &n, NULL); CloseHandle(h);
  if (!r || !n) return 0; buf[n] = 0;
  unsigned long p = 0; long long ts = 0;
  if (sscanf(buf, "%lu %lld", &p, &ts) != 2 || !p || !ts) return 0;
  if (llabs(now_ms() - ts) > 6000 || !pid_alive((DWORD)p)) return 0;
  *pid = (DWORD)p; title[0] = 0;
  char *nl = strchr(buf, '\n');
  if (nl) {
    nl++; char *e = nl + strlen(nl); while (e > nl && (e[-1] == '\r' || e[-1] == '\n' || e[-1] == ' ')) *--e = 0;
    MultiByteToWideChar(CP_UTF8, 0, nl, -1, title, tcap);
  }
  return 1;
}

typedef struct { const WCHAR *want; HWND exact, any; } FindCtx;
static BOOL CALLBACK enum_cb(HWND w, LPARAM lp) {
  FindCtx *c = (FindCtx *)lp; WCHAR t[512], cls[64];
  if (!IsWindowVisible(w) && !IsIconic(w)) return TRUE;
  if (!GetWindowTextW(w, t, 512)) return TRUE;
  GetClassNameW(w, cls, 64);
  if (wcsncmp(cls, L"Chrome_WidgetWin", 16)) return TRUE; /* smartPDF 的窗口是 Edge 窗口 */
  if (c->want && c->want[0] && !wcscmp(t, c->want)) { c->exact = w; return FALSE; }
  size_t L = wcslen(t);
  if (!c->any && (!wcscmp(t, L"smartPDF") || (L > 11 && !wcscmp(t + L - 11, L" - smartPDF")))) c->any = w;
  return TRUE;
}

static void bring_front(const WCHAR *title) {
  FindCtx c = { title, NULL, NULL };
  EnumWindows(enum_cb, (LPARAM)&c);
  HWND w = c.exact ? c.exact : c.any;
  if (!w) return;
  if (IsIconic(w)) ShowWindow(w, SW_RESTORE);
  if (!SetForegroundWindow(w)) {
    /* 轻按一下 Alt，Windows 才肯让别的窗口到前面 */
    keybd_event(VK_MENU, 0, 0, 0); keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
    SetForegroundWindow(w);
  }
  BringWindowToTop(w);
}

static int exists(const WCHAR *f) { return GetFileAttributesW(f) != INVALID_FILE_ATTRIBUTES; }

/* 把文件交给开着的 smartPDF。它 0.4 秒看一次收件夹，拿走了文件就会消失 */
static int hand_off(const WCHAR *path, const WCHAR *title) {
  CreateDirectoryW(g_inbox, NULL);
  WCHAR tmp[MAX_PATH], fin[MAX_PATH]; long long t = now_ms(); DWORD me = GetCurrentProcessId();
  swprintf(tmp, MAX_PATH, L"%ls\\%lld-%lu.part", g_inbox, t, (unsigned long)me);
  swprintf(fin, MAX_PATH, L"%ls\\%lld-%lu.txt", g_inbox, t, (unsigned long)me);
  int n = WideCharToMultiByte(CP_UTF8, 0, path, -1, NULL, 0, NULL, NULL);
  char *u = (char *)malloc(n); if (!u) return 0;
  WideCharToMultiByte(CP_UTF8, 0, path, -1, u, n, NULL, NULL);
  HANDLE h = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, 0, NULL);
  if (h == INVALID_HANDLE_VALUE) { free(u); return 0; }
  DWORD w = 0; int ok = WriteFile(h, u, (DWORD)(n - 1), &w, NULL); CloseHandle(h); free(u);
  if (!ok || !MoveFileExW(tmp, fin, MOVEFILE_REPLACE_EXISTING)) { DeleteFileW(tmp); return 0; }
  for (int i = 0; i < 40; i++) { /* 最多等 4 秒 */
    Sleep(100);
    if (!exists(fin)) { bring_front(title); return 1; }
  }
  if (DeleteFileW(fin)) return 0;   /* 没人拿：收回来，自己开 */
  bring_front(title); return 1;      /* 刚好被拿走了 */
}

static int is_pdf(const WCHAR *a) {
  size_t L = wcslen(a);
  return L > 4 && !_wcsicmp(a + L - 4, L".pdf");
}

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE hp, PWSTR cmd, int show) {
  (void)hi; (void)hp; (void)cmd; (void)show;
  DWORD n = GetEnvironmentVariableW(L"TEMP", g_temp, MAX_PATH);
  if (!n || n >= MAX_PATH) n = GetTempPathW(MAX_PATH, g_temp);
  while (n && (g_temp[n - 1] == L'\\' || g_temp[n - 1] == L'/')) g_temp[--n] = 0;
  swprintf(g_live, MAX_PATH, L"%ls\\smartpdf-live.txt", g_temp);
  swprintf(g_inbox, MAX_PATH, L"%ls\\smartpdf-inbox", g_temp);

  int argc = 0; LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  const WCHAR *file = NULL;
  for (int i = 1; argv && i < argc; i++) if (is_pdf(argv[i])) { file = argv[i]; break; }

  /* 同时开好几个：一个一个来 */
  HANDLE mx = CreateMutexW(NULL, FALSE, L"Local\\smartPDF-open");
  if (mx) WaitForSingleObject(mx, 15000);

  WCHAR title[512]; DWORD live = 0;
  if (file && read_live(&live, title, 512) && hand_off(file, title)) {
    if (mx) { ReleaseMutex(mx); CloseHandle(mx); }
    return 0;
  }

  /* 启动旁边的 smartPDF.exe，参数原样带过去 */
  WCHAR exe[MAX_PATH]; GetModuleFileNameW(NULL, exe, MAX_PATH);
  WCHAR *sl = wcsrchr(exe, L'\\'); if (sl) wcscpy(sl + 1, L"smartPDF.exe");
  WCHAR dir[MAX_PATH]; wcscpy(dir, exe); sl = wcsrchr(dir, L'\\'); if (sl) *sl = 0;
  const WCHAR *rest = GetCommandLineW();   /* 去掉自己的名字，剩下的就是参数 */
  if (*rest == L'"') { rest++; while (*rest && *rest != L'"') rest++; if (*rest) rest++; }
  else while (*rest && *rest != L' ' && *rest != L'\t') rest++;
  size_t cl = wcslen(exe) + wcslen(rest) + 4;
  WCHAR *line = (WCHAR *)malloc(cl * sizeof(WCHAR));
  swprintf(line, cl, L"\"%ls\"%ls", exe, rest);
  STARTUPINFOW si; PROCESS_INFORMATION pi; ZeroMemory(&si, sizeof si); si.cb = sizeof si; ZeroMemory(&pi, sizeof pi);
  AllowSetForegroundWindow(ASFW_ANY);
  if (CreateProcessW(exe, line, NULL, NULL, FALSE, 0, NULL, dir, &si, &pi)) {
    /* 等它开好（开始写「我还在」），排在后面的才能交给它；最多等 12 秒 */
    if (file) {
      for (int i = 0; i < 120; i++) {
        DWORD p = 0; WCHAR t2[8];
        if (read_live(&p, t2, 8)) break; /* 之前没有开着的，现在有了就是它 */
        if (WaitForSingleObject(pi.hProcess, 100) == WAIT_OBJECT_0) break;
      }
    }
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
  }
  free(line);
  if (mx) { ReleaseMutex(mx); CloseHandle(mx); }
  return 0;
}
