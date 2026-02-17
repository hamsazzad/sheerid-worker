import sys, subprocess, re, os

# args
url = sys.argv[1].strip()
uid = sys.argv[2].strip()

url_l = url.lower()

RESULT_FILE = f"result_{uid}.txt"

def write_result(val: str):
    with open(RESULT_FILE, "w", encoding="utf-8") as f:
        f.write(val.strip().upper())

def pick_tool():
    # NOTE: এগুলো তোমার zip-এ যে folder/path আছে সেভাবে মিলিয়ে দাও।
    # যদি folder name আলাদা হয়, শুধু এই return path গুলো ঠিক করলেই হবে।
    if "spotify" in url_l:
        return "SheerID-Verification-Tool-master/spotify-verify-tool/main.py"
    if "k12" in url_l:
        return "SheerID-Verification-Tool-master/k12-verify-tool/main.py"
    if "veteran" in url_l or "military" in url_l:
        return "SheerID-Verification-Tool-master/veterans-verify-tool/main.py"
    if "teacher" in url_l:
        return "SheerID-Verification-Tool-master/canva-teacher-tool/main.py"
    return "SheerID-Verification-Tool-master/one-verify-tool/main.py"

def run_cmd(cmd):
    # returns combined stdout
    try:
        p = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        out = ""
        for line in p.stdout:
            print(line.rstrip(), flush=True)  # debug log in Actions
            out += line.lower()
        return out
    except Exception as e:
        print("ERROR:", e, flush=True)
        return ""

# 1) init
print("RUNNER_START", flush=True)
write_result("WAIT")

# 2) run selected tool
tool = pick_tool()
print("TOOL =", tool, flush=True)

# Most scripts accept: python main.py <url>
output = run_cmd(["python", tool, url])

# 3) classify
# SUCCESS keywords
if re.search(r"\b(success|verified|approved|eligible|congratulations)\b", output):
    write_result("SUCCESS")
    print("FINAL:SUCCESS", flush=True)

# PENDING keywords
elif re.search(r"\b(pending|upload|document|documents|review|additional)\b", output):
    write_result("PENDING")
    print("FINAL:PENDING", flush=True)

# FRAUD keywords
elif re.search(r"\b(fraud|blocked|abuse|suspended|unusual|suspicious)\b", output):
    write_result("FRAUD")
    print("FINAL:FRAUD", flush=True)

else:
    write_result("FAILED")
    print("FINAL:FAILED", flush=True)
