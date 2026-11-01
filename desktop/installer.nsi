Unicode true
ManifestDPIAware true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define APP "smartPDF"
!define VER "2.0.1"
!define EXE "smartPDF.exe"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\smartPDF"

Name "${APP}"
OutFile "smartPDF-Setup-${VER}.exe"
InstallDir "$LOCALAPPDATA\Programs\smartPDF"
InstallDirRegKey HKCU "Software\smartPDF" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "smartPDF ${VER}"
VIProductVersion "2.0.1.0"
VIAddVersionKey /LANG=0 "ProductName" "smartPDF"
VIAddVersionKey /LANG=0 "FileDescription" "smartPDF Setup"
VIAddVersionKey /LANG=0 "FileVersion" "${VER}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VER}"
VIAddVersionKey /LANG=0 "CompanyName" "PLANET COMPUTER TECHNOLOGY CENTRE"
VIAddVersionKey /LANG=0 "LegalCopyright" "© 2026 PLANET COMPUTER TECHNOLOGY CENTRE"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "side.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "side.bmp"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

LangString DocName ${LANG_SIMPCHINESE} "PDF 文件"
LangString DocName ${LANG_ENGLISH} "PDF document"
LangString NeedEdge ${LANG_SIMPCHINESE} "smartPDF 用微软 Edge 浏览器显示窗口，这台电脑好像没有 Edge。$\r$\n$\r$\n点「确定」打开微软的下载页，装好后就能使用 smartPDF。"
LangString NeedEdge ${LANG_ENGLISH} "smartPDF uses Microsoft Edge to show its window, and this computer does not seem to have Edge.$\r$\n$\r$\nClick OK to open Microsoft's download page. smartPDF will work once it is installed."
LangString Running ${LANG_SIMPCHINESE} "smartPDF 正在运行，请先关闭它再继续。"
LangString Running ${LANG_ENGLISH} "smartPDF is running. Please close it and try again."

Section "smartPDF"
  SetOutPath "$INSTDIR"
  ; 关掉旧版本（包括 v2.0 卡在任务栏的进程）
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Pop $0
  Sleep 500
  ClearErrors
  Delete "$INSTDIR\${EXE}"
  ${If} ${Errors}
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(Running)" /SD IDOK
    Abort
  ${EndIf}
  File "${EXE}"
  File "resources.neu"
  File "icon.ico"
  File "pdf-file.ico"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\smartPDF" "InstallDir" "$INSTDIR"

  CreateShortcut "$SMPROGRAMS\smartPDF.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$DESKTOP\smartPDF.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\icon.ico" 0

  ; 打开方式 / Open with
  WriteRegStr HKCU "Software\Classes\smartPDF.Document" "" "$(DocName)"
  WriteRegStr HKCU "Software\Classes\smartPDF.Document\DefaultIcon" "" "$INSTDIR\pdf-file.ico"
  WriteRegStr HKCU "Software\Classes\smartPDF.Document\shell\open\command" "" '"$INSTDIR\${EXE}" "%1"'
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "smartPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}" "FriendlyAppName" "smartPDF"
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\SupportedTypes" ".pdf" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXE}\shell\open\command" "" '"$INSTDIR\${EXE}" "%1"'
  ; 默认软件设定里能找到 smartPDF / Shows up in Windows Default apps
  WriteRegStr HKCU "Software\smartPDF\Capabilities" "ApplicationName" "smartPDF"
  WriteRegStr HKCU "Software\smartPDF\Capabilities" "ApplicationDescription" "smartPDF - PDF viewer and editor"
  WriteRegStr HKCU "Software\smartPDF\Capabilities\FileAssociations" ".pdf" "smartPDF.Document"
  WriteRegStr HKCU "Software\RegisteredApplications" "smartPDF" "Software\smartPDF\Capabilities"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  WriteRegStr HKCU "${UNKEY}" "DisplayName" "smartPDF"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "PLANET COMPUTER TECHNOLOGY CENTRE"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNKEY}" "EstimatedSize" 5200

  ; Edge 检查
  ${IfNot} ${FileExists} "$PROGRAMFILES32\Microsoft\Edge\Application\msedge.exe"
  ${AndIfNot} ${FileExists} "$PROGRAMFILES64\Microsoft\Edge\Application\msedge.exe"
  ${AndIfNot} ${FileExists} "$LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ${AndIfNot} ${FileExists} "$PROGRAMFILES64\Google\Chrome\Application\chrome.exe"
  ${AndIfNot} ${FileExists} "$PROGRAMFILES32\Google\Chrome\Application\chrome.exe"
    MessageBox MB_ICONINFORMATION|MB_OKCANCEL "$(NeedEdge)" /SD IDCANCEL IDCANCEL +2
    ExecShell "open" "https://www.microsoft.com/edge/download"
  ${EndIf}
SectionEnd

; 软件里按「现在更新」时会用 /S 安静安装，装好后自动重新打开 smartPDF
Function .onInstSuccess
  ${If} ${Silent}
    Exec '"$INSTDIR\${EXE}"'
  ${EndIf}
FunctionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\smartPDF.lnk"
  Delete "$DESKTOP\smartPDF.lnk"
  DeleteRegKey HKCU "Software\Classes\smartPDF.Document"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "smartPDF.Document"
  DeleteRegValue HKCU "Software\RegisteredApplications" "smartPDF"
  DeleteRegKey HKCU "Software\smartPDF\Capabilities"
  DeleteRegKey HKCU "Software\Classes\Applications\${EXE}"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\smartPDF"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  RMDir /r "$INSTDIR"
SectionEnd
