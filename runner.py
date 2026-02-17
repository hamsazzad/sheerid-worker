import sys, subprocess, re

url = sys.argv[1].strip().lower()

def pick():
    if "spotify" in url:
        return "spotify-verify-tool/main.py"
    if "k12" in url:
        return "k12-verify-tool/main.py"
    if "veteran" in url:
        return "veterans-verify-tool/main.py"
    if "teacher" in url or "canva" in url:
        return "canva-teacher-tool/main.py"
    if "youtube" in url:
        return "youtube-verify-tool/main.py"
    return "one-verify-tool/main.py"

tool = pick()
print("RUN:", tool, flush=True)

try:
    p = subprocess.Popen(
        ["python3", tool, url],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    output=""
    for line in p.stdout:
        print(line.strip(), flush=True)
        output += line.lower()

except:
    print("FINAL_FAILED")
    sys.exit()

def has(words):
    return any(w in output for w in words)

if has(["verified","approved","eligible","success"]):
    print("FINAL_SUCCESS")

elif has(["pending","document","review","upload"]):
    print("FINAL_PENDING")

elif has(["fraud","abuse","blocked","suspended"]):
    print("FINAL_FRAUD")

else:
    print("FINAL_FAILED")
