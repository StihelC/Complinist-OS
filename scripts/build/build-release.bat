@echo off
REM Build Release Script for CompliFlow (Windows)
REM Prompts for version number and builds installers

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   CompliFlow Release Builder
echo ========================================
echo.

REM Get current version from package.json
for /f "tokens=*" %%i in ('node -p "require('./package.json').version" 2^>nul') do set CURRENT_VERSION=%%i
if "!CURRENT_VERSION!"=="" set CURRENT_VERSION=1.0.0

echo Current version: !CURRENT_VERSION!
echo.

REM Prompt for new version
set /p NEW_VERSION="Enter the new release version (e.g., 1.0.1, 1.1.0) [!CURRENT_VERSION!]: "
if "!NEW_VERSION!"=="" set NEW_VERSION=!CURRENT_VERSION!

echo.
echo Building release version: !NEW_VERSION!
echo.

REM Update version in package.json
echo Updating version in package.json...
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '!NEW_VERSION!'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"
if errorlevel 1 (
    echo ERROR: Failed to update package.json
    exit /b 1
)
echo Version updated to !NEW_VERSION!
echo.

REM Prompt for build target
echo Select build target:
echo   1) Windows only
echo   2) Linux only (requires WSL or cross-compilation)
echo   3) Both Windows and Linux
echo   4) Current platform only
set /p BUILD_CHOICE="Choice [1]: "
if "!BUILD_CHOICE!"=="" set BUILD_CHOICE=1

if "!BUILD_CHOICE!"=="1" (
    set BUILD_CMD=npm run electron:build:win
    set BUILD_TARGET=Windows
) else if "!BUILD_CHOICE!"=="2" (
    set BUILD_CMD=npm run electron:build:linux
    set BUILD_TARGET=Linux
) else if "!BUILD_CHOICE!"=="3" (
    set BUILD_CMD=npm run electron:build:all
    set BUILD_TARGET=All platforms
) else if "!BUILD_CHOICE!"=="4" (
    set BUILD_CMD=npm run electron:build
    set BUILD_TARGET=Current platform
) else (
    echo ERROR: Invalid choice
    exit /b 1
)

echo.
echo Build target: !BUILD_TARGET!
echo Build command: !BUILD_CMD!
echo.

REM Prompt for output directory using file picker
set DEFAULT_OUTPUT_DIR=%CD%\release
echo.
echo Select output directory for build files...

REM Use PowerShell to show folder picker dialog
for /f "delims=" %%i in ('powershell -NoProfile -Command "$folder = New-Object -ComObject Shell.Application; $selected = $folder.BrowseForFolder(0, 'Select Output Directory for Build Files', 0, '%DEFAULT_OUTPUT_DIR%'); if ($selected) { $selected.Self.Path }"') do set OUTPUT_DIR=%%i

REM Fallback to text input if PowerShell dialog cancelled or failed
if "!OUTPUT_DIR!"=="" (
    echo.
    echo GUI file picker cancelled or not available. Enter path manually:
    set /p OUTPUT_DIR="Output directory [release]: "
    if "!OUTPUT_DIR!"=="" set OUTPUT_DIR=release
    
    REM Convert relative path to absolute
    if not "!OUTPUT_DIR:~0,1!"=="\" if not "!OUTPUT_DIR:~0,2!"=="" (
        set OUTPUT_DIR=%CD%\!OUTPUT_DIR!
    )
)

REM Remove trailing backslash if present
if "!OUTPUT_DIR:~-1!"=="\" set OUTPUT_DIR=!OUTPUT_DIR:~0,-1!

REM Create output directory if it doesn't exist
if not exist "!OUTPUT_DIR!" (
    echo Creating output directory: !OUTPUT_DIR!
    mkdir "!OUTPUT_DIR!"
    if errorlevel 1 (
        echo ERROR: Failed to create output directory
        exit /b 1
    )
    echo Output directory created.
) else (
    echo Using existing output directory: !OUTPUT_DIR!
)

REM Create temporary electron-builder config with custom output
set TEMP_CONFIG=%TEMP%\electron-builder-%RANDOM%.yml
echo Creating temporary config: !TEMP_CONFIG!

REM Create config file using Node.js
node -e "const fs = require('fs'); const path = require('path'); const outputDir = '!OUTPUT_DIR:\\=/%'; const config = \`appId: com.compliflow.desktop\nproductName: CompliFlow\ncopyright: Copyright © 2024\n\ndirectories:\n  buildResources: build\n  output: \${outputDir}\n\nfiles:\n  - dist/**/*\n  - electron/**/*\n  - package.json\n  - node_modules/**/*\n  - \"!node_modules/**/*.{md,ts,map}\"\n\nextraFiles:\n  - from: \".data/models\"\n    to: \"resources/models\"\n    filter:\n      - \"**/*.gguf\"\n  - from: \".data/chroma_db\"\n    to: \"resources/chroma_db\"\n    filter:\n      - \"**/*\"\n\nwin:\n  target:\n    - target: nsis\n      arch:\n        - x64\n    - target: portable\n      arch:\n        - x64\n  icon: build/icon.ico\n  publisherName: CompliFlow\n  requestedExecutionLevel: asInvoker\n\nlinux:\n  target:\n    - AppImage\n    - deb\n    - rpm\n  category: Office\n  icon: build/icon.png\n  desktop:\n    Name: CompliFlow\n    Comment: NIST Compliance and System Security Planning Tool\n    Categories: Office;Security;\n    StartupWMClass: compliflow-desktop\n\nnsis:\n  oneClick: false\n  allowToChangeInstallationDirectory: true\n  createDesktopShortcut: true\n  createStartMenuShortcut: true\n  shortcutName: CompliFlow\n  installerIcon: build/icon.ico\n  uninstallerIcon: build/icon.ico\n  installerHeaderIcon: build/icon.ico\n\nappImage:\n  artifactName: \${productName}-\${version}-\${arch}.\${ext}\n\ndeb:\n  depends:\n    - libnss3\n    - libatk-bridge2.0-0\n    - libdrm2\n    - libxkbcommon0\n    - libxcomposite1\n    - libxdamage1\n    - libxfixes3\n    - libxrandr2\n    - libgbm1\n    - libasound2\n\nrpm:\n  depends:\n    - nss\n    - atk\n    - libdrm\n    - libxkbcommon\n    - libXcomposite\n    - libXdamage\n    - libXfixes\n    - libXrandr\n    - mesa-libgbm\n    - alsa-lib\n\npublish: null\n\`; fs.writeFileSync('!TEMP_CONFIG!', config);"
if errorlevel 1 (
    echo ERROR: Failed to create temporary config
    exit /b 1
)

REM Update build commands to use custom config
if "!BUILD_CHOICE!"=="1" (
    set BUILD_CMD=npm run build ^&^& electron-builder --win --config "!TEMP_CONFIG!"
) else if "!BUILD_CHOICE!"=="2" (
    set BUILD_CMD=npm run build ^&^& electron-builder --linux --config "!TEMP_CONFIG!"
) else if "!BUILD_CHOICE!"=="3" (
    set BUILD_CMD=npm run build ^&^& electron-builder --win --linux --config "!TEMP_CONFIG!"
) else if "!BUILD_CHOICE!"=="4" (
    set BUILD_CMD=npm run build ^&^& electron-builder --config "!TEMP_CONFIG!"
)

echo.
echo Output directory: !OUTPUT_DIR!
echo.

REM Check if icons exist
if not exist "build\icon.png" (
    echo Generating icons...
    call npm run create-icons
    if errorlevel 1 (
        echo ERROR: Failed to create icons
        exit /b 1
    )
)

REM Check if dist exists
if not exist "dist" (
    echo Building frontend...
    call npm run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed
        exit /b 1
    )
    echo Frontend built successfully.
) else (
    set /p REBUILD="Frontend already built. Rebuild? (y/N): "
    if /i "!REBUILD!"=="Y" (
        echo Rebuilding frontend...
        call npm run build
        if errorlevel 1 (
            echo ERROR: Frontend build failed
            exit /b 1
        )
        echo Frontend rebuilt successfully.
    )
)

echo.
echo Starting Electron build process...
echo.

REM Run the build
call !BUILD_CMD!
if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    if exist "!TEMP_CONFIG!" del "!TEMP_CONFIG!"
    exit /b 1
)

REM Clean up temporary config
if exist "!TEMP_CONFIG!" del "!TEMP_CONFIG!"

REM Create release archives
echo.
echo Creating release archives...
node scripts/create-release-archive.js --platform=win
if errorlevel 1 (
    echo.
    echo ERROR: Archive creation failed!
    exit /b 1
)

echo.
echo ========================================
echo   Build completed successfully!
echo ========================================
echo.
echo Generated archives in !OUTPUT_DIR!\ directory:
dir /b "!OUTPUT_DIR!\*.zip" "!OUTPUT_DIR!\*.tar.gz" 2>nul
echo.
echo Release !NEW_VERSION! is ready!
echo Files are located in: !OUTPUT_DIR!\
echo.
echo Done!
pause

