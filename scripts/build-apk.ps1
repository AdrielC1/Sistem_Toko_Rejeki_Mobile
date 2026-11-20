$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
# Gunakan path pendek C:\t (4 karakter) + C:/cx CMake staging
# agar seluruh path CMake/Ninja codegen tetap di bawah batas 260 karakter Windows.
$ShortBuildDir = "C:\t"
$WebDownloadsDir = Resolve-Path (Join-Path $ProjectRoot "..\Apps_Toko_Rejeki\apps\public") -ErrorAction SilentlyContinue

if (-not $env:ANDROID_HOME) {
  $DefaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $DefaultSdk) {
    $env:ANDROID_HOME = $DefaultSdk
  } else {
    Write-Error "ANDROID_HOME tidak ditemukan di $DefaultSdk"
    exit 1
  }
}

Write-Host "==> [1/5] Menyinkronkan source code ke direktori build pendek ($ShortBuildDir)..." -ForegroundColor Cyan
if (-not (Test-Path $ShortBuildDir)) {
  New-Item -ItemType Directory -Path $ShortBuildDir | Out-Null
}

$RobocopyArgs = @(
  $ProjectRoot,
  $ShortBuildDir,
  "/MIR",
  "/XD", "node_modules", ".expo", ".git", "android", "ios", "dist", ".planning", "__tests__",
  "/XF", "*.log",
  "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS"
)
& robocopy @RobocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) {
  Write-Error "Robocopy gagal dengan kode $LASTEXITCODE"
  exit 1
}

Push-Location $ShortBuildDir
try {
  $PkgHashFile = Join-Path $ShortBuildDir ".pkg-lock.hash"
  $CurrentHash = (Get-FileHash (Join-Path $ShortBuildDir "package-lock.json") -Algorithm SHA256).Hash
  $SavedHash = if (Test-Path $PkgHashFile) { Get-Content $PkgHashFile -Raw } else { "" }

  if (-not (Test-Path (Join-Path $ShortBuildDir "node_modules")) -or ($CurrentHash.Trim() -ne $SavedHash.Trim())) {
    Write-Host "==> [2/5] Menginstal dependensi npm di $ShortBuildDir..." -ForegroundColor Cyan
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install gagal" }
    Set-Content -Path $PkgHashFile -Value $CurrentHash.Trim()
  } else {
    Write-Host "==> [2/5] Dependensi node_modules sudah mutakhir, melewati npm install." -ForegroundColor Green
  }

  Write-Host "==> [3/5] Menjalankan Expo Prebuild Android..." -ForegroundColor Cyan
  npx expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) { throw "expo prebuild gagal" }

  Write-Host "==> [4/5] Mem-build Release APK (arm64-v8a) via Gradle..." -ForegroundColor Cyan
  Push-Location (Join-Path $ShortBuildDir "android")
  try {
    .\gradlew.bat assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleRelease gagal" }
  } finally {
    Pop-Location
  }

  $BuiltApk = Join-Path $ShortBuildDir "android\app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path $BuiltApk)) {
    throw "File APK hasil build tidak ditemukan di $BuiltApk"
  }

  Write-Host "==> [5/5] Menyalin file APK ke folder tujuan..." -ForegroundColor Cyan
  $LocalDistDir = Join-Path $ProjectRoot "dist"
  if (-not (Test-Path $LocalDistDir)) {
    New-Item -ItemType Directory -Path $LocalDistDir | Out-Null
  }
  $LocalApkPath = Join-Path $LocalDistDir "toko-rejeki-pos.apk"
  Copy-Item -Path $BuiltApk -Destination $LocalApkPath -Force
  Write-Host "    -> Tersimpan di: $LocalApkPath" -ForegroundColor Green

  $WebPublicRoot = Join-Path $ProjectRoot "..\Apps_Toko_Rejeki\apps\public"
  if (Test-Path $WebPublicRoot) {
    $WebApkDir = Join-Path $WebPublicRoot "downloads"
    if (-not (Test-Path $WebApkDir)) {
      New-Item -ItemType Directory -Path $WebApkDir | Out-Null
    }
    $WebApkPath = Join-Path $WebApkDir "toko-rejeki-pos.apk"
    Copy-Item -Path $BuiltApk -Destination $WebApkPath -Force
    Write-Host "    -> Tersimpan di Web Apps_Toko_Rejeki: $WebApkPath" -ForegroundColor Green
  }

  Write-Host "`nSELESAI! File APK siap diunduh dan di-install di HP toko." -ForegroundColor Green
} finally {
  Pop-Location
}
