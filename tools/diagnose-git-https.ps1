# git HTTPS diagnostics (read-only, does not change any config)
$git = "C:\Users\25856\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd\git.exe"
$env:GIT_TERMINAL_PROMPT = "0"
$repo = "https://github.com/zmh090523-arch/zmh090523-arch.github.io.git"

function Section($t) { Write-Output ""; Write-Output ("=" * 68); Write-Output $t; Write-Output ("=" * 68) }

Section "1. Basic info"
Write-Output ("git version : " + (& $git --version 2>&1))
Write-Output ("git path    : " + $git)
Write-Output ("HTTPS_PROXY : [" + $env:HTTPS_PROXY + "]")
Write-Output ("HTTP_PROXY  : [" + $env:HTTP_PROXY + "]")
Write-Output ("ALL_PROXY   : [" + $env:ALL_PROXY + "]")
Write-Output ("NO_PROXY    : [" + $env:NO_PROXY + "]")

Section "2. git ssl/proxy/credential config"
foreach ($scope in @('--global','--system')) {
  Write-Output "--- $scope ---"
  $out = & $git config $scope --list 2>&1 | Select-String -Pattern 'ssl|proxy|http\.|credential|cainfo|schannel'
  if ($out) { $out | ForEach-Object { Write-Output ("  " + $_) } } else { Write-Output "  (none)" }
}

Section "3. schannel backend"
$r1 = & $git -c http.sslBackend=schannel ls-remote $repo 2>&1
Write-Output ("  exit=" + $LASTEXITCODE)
$r1 | Select-Object -First 3 | ForEach-Object { Write-Output ("  " + $_) }

Section "4. openssl backend"
$r2 = & $git -c http.sslBackend=openssl ls-remote $repo 2>&1
Write-Output ("  exit=" + $LASTEXITCODE)
$r2 | Select-Object -First 3 | ForEach-Object { Write-Output ("  " + $_) }

Section "5. schannel without revocation check"
$r3 = & $git -c http.schannelCheckRevoke=false ls-remote $repo 2>&1
Write-Output ("  exit=" + $LASTEXITCODE)
$r3 | Select-Object -First 3 | ForEach-Object { Write-Output ("  " + $_) }

Section "6. verify disabled (isolates cert-store vs network)"
$r4 = & $git -c http.sslVerify=false ls-remote $repo 2>&1
Write-Output ("  exit=" + $LASTEXITCODE)
$r4 | Select-Object -First 3 | ForEach-Object { Write-Output ("  " + $_) }

Section "7. Windows curl (schannel) for comparison"
$curl = "C:\Windows\System32\curl.exe"
$r5 = & $curl -sS -o NUL -w "HTTP %{http_code}" --max-time 25 https://github.com/ 2>&1
Write-Output ("  curl schannel -> " + ($r5 -join ' '))

Section "8. certificate stores readable?"
foreach ($store in @('Cert:\LocalMachine\Root','Cert:\CurrentUser\Root','Cert:\CurrentUser\My','Cert:\LocalMachine\CA')) {
  try {
    $n = (Get-ChildItem $store -ErrorAction Stop | Measure-Object).Count
    Write-Output ("  " + $store + " -> " + $n + " certs")
  } catch {
    Write-Output ("  " + $store + " -> ERROR: " + $_.Exception.Message)
  }
}

Section "9. git bundled CA bundles"
$gitdir = Split-Path (Split-Path $git -Parent) -Parent
Write-Output ("  git root: " + $gitdir)
$cands = @(
  "$gitdir\mingw64\ssl\certs\ca-bundle.crt",
  "$gitdir\mingw64\etc\ssl\certs\ca-bundle.crt",
  "$gitdir\ssl\certs\ca-bundle.crt",
  "$gitdir\mingw64\ssl\cert.pem",
  "$gitdir\usr\ssl\certs\ca-bundle.crt"
)
foreach ($p in $cands) {
  $exists = Test-Path $p
  Write-Output ("  [" + $(if ($exists) { "OK " } else { "MISS" }) + "] " + $p)
}
Write-Output ""
Write-Output "diagnostics done."
