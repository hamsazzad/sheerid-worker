import sys, subprocess, re, os

url = sys.argv[1].strip().lower()

BASE = os.getcwd()

# -------- find correct base folder ----------
def find_tool(path):
    if os.path.exists(path):
        return path

    alt = os.path.join("SheerID-Verification-Tool-master", path)
    if os.path.exists(alt):
        return alt

    return None

# -------- choose tool ----------
def pick():
    if "spotify" in url:
        return find_tool("spotify-verify-tool/main.py")

    if "k12" in url:
        return find_tool("k12-verify-tool/main.py")

    if "veteran" in url:
        return find_tool("veterans-verify-tool/main.py")

    if "teacher" in url or "canva" in url:
        return find_tool("canva-teacher-tool/main.py")

    if "perplexity" in url:
        return find_tool("perplexity-verify-tool/main.py")

    if "youtube" in url:
        return find_tool("youtube-verify-tool/main.py")

    return find_tool("one-verify-tool/main.py")

tool = pick()

if not tool:
    print("TOOL_NOT_FOUND")
    print("FINAL_FAILED")
    sys.exit(0)

print("RUNNING:", tool, flush=True)

# -------- run tool ----------
try:
    proc = subprocess.Popen(
        ["python", tool, url],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    output = ""
    for line in proc.stdout:
        line = line.strip()
        print(line, flush=True)
        output += line.lower() + "\n"

except Exception as e:
    print("ERROR:", str(e))
    print("FINAL_FAILED")
    sys.exit(0)

# -------- SMART CLASSIFIER ----------

def contains(words):
    return any(w in output for w in words)

# SUCCESS
if contains([
    "verified",
    "you're eligible",
    "you’re eligible",
    "eligible for the offer",
    "verification successful",
    "approved",
    "congratulations",
    "student verified"
]):
    print("FINAL_SUCCESS")

# PENDING
elif contains([
    "upload document",
    "upload documents",
    "manual review",
    "pending verification",
    "additional information required",
    "verify your status",
    "needs review"
]):
    print("FINAL_PENDING")

# FRAUD
elif contains([
    "fraud",
    "abuse",
    "blocked",
    "suspended",
    "too many attempts",
    "temporarily locked",
    "security reasons"
]):
    print("FINAL_FRAUD")

# FAILED
elif contains([
    "not eligible",
    "cannot verify",
    "unable to verify",
    "we couldn't verify",
    "doesn’t qualify",
    "does not qualify"
]):
    print("FINAL_FAILED")

else:
    print("FINAL_FAILED")
