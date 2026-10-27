' Doble clic: abre la Mesa de D&D sin ventana negra (solo el navegador).
' Sigue funcionando por detras hasta que apagas el ordenador o usas "Cerrar Mesa DnD.bat".
' Si ya estaba abierta, solo abre el navegador. Los mensajes quedan en data\mesa.log.
' Para que arranque sola al encender el ordenador, copia este archivo en la carpeta de
' Inicio de Windows (Win + R y escribe shell:startup).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
app = """" & dir & "\app.py"""

' pyw y pythonw son Python sin consola
If sh.Run("cmd /c where pyw", 0, True) = 0 Then
    sh.Run "pyw -3 " & app, 0, False
ElseIf sh.Run("cmd /c where pythonw", 0, True) = 0 Then
    sh.Run "pythonw " & app, 0, False
Else
    MsgBox "No se ha encontrado Python en este ordenador." & vbCrLf & _
        "Instalalo desde https://www.python.org/downloads/ y marca la casilla ""Add python.exe to PATH"".", 48, "Mesa de D&D"
End If
