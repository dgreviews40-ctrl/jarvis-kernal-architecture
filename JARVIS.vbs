' JARVIS Launcher - Silent startup
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Check if Node is installed
On Error Resume Next
WshShell.Run "cmd /c node --version", 0, True
If Err.Number <> 0 Then
    MsgBox "Node.js is not installed. Please install Node.js from https://nodejs.org/", vbCritical, "JARVIS Error"
    WScript.Quit 1
End If
On Error GoTo 0

' Run the launcher in a hidden window
WshShell.Run "cmd /c cd /d """ & strPath & """ && node launcher.cjs", 0, False

' Show a message that JARVIS is starting
MsgBox "JARVIS is starting..." & vbCrLf & vbCrLf & "The browser will open automatically when ready.", vbInformation, "JARVIS"
