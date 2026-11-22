@echo off
echo =======================================================
echo Building Android APK for Antigrav Chat...
echo =======================================================

if not defined JAVA_HOME (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
        set "PATH=C:\Program Files\Android\Android Studio\jbr\bin;%PATH%"
    )
)

if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

cd client
echo 1. Building React Web Assets...
call npm run build

echo 2. Syncing Capacitor Android Project...
call npx cap sync android

cd android
echo 3. Compiling APK via Gradle...
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo [SUCCESS] APK compiled successfully!
    echo Location: client\android\app\build\outputs\apk\debug\app-debug.apk
    echo =======================================================
) else (
    echo.
    echo [NOTE] Gradle build requires Java JDK and Android SDK.
    echo If they are not installed locally, you can open:
    echo   "c:\AntigravPro\client\android"
    echo in Android Studio and click "Build -> Build APK".
)
pause