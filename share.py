import subprocess
import sys
import time
import re

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("==========================================================", flush=True)
    print("  Derma & Bare AI Chatbot - Instant Share Link Generator  ", flush=True)
    print("==========================================================", flush=True)

    print("\n1. Starting Flask server locally...", flush=True)
    flask_process = subprocess.Popen(
        [sys.executable, "app.py"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    time.sleep(2)
    print("   Flask server is running on http://localhost:5000", flush=True)

    print("\n2. Opening public secure HTTPS tunnel...", flush=True)
    tunnel_process = subprocess.Popen(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-R", "80:localhost:5000", "nokey@localhost.run"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1
    )

    found_url = False
    try:
        for line in iter(tunnel_process.stdout.readline, ''):
            if not line:
                break
            line_str = line.strip()
            print("   " + line_str, flush=True)
            if "https://" in line_str and not found_url and ("lhr.life" in line_str or "tunneled" in line_str):
                match = re.search(r'https://[a-zA-Z0-9.-]+\.lhr\.life', line_str)
                if match:
                    found_url = True
                    public_url = match.group(0)
                    print("\n" + "==========================================================", flush=True)
                    print("  🎉 YOUR SHAREABLE CHATBOT LINK IS LIVE!", flush=True)
                    print(f"  👉 {public_url}", flush=True)
                    print("==========================================================", flush=True)
                    print("\nSend this HTTPS link to your friend on WhatsApp, email, or SMS.", flush=True)
                    print("NOTE: Keep this terminal window open while your friend is using the app.", flush=True)
                    print("Press Ctrl+C anytime to stop sharing.\n", flush=True)
        
        tunnel_process.wait()
    except KeyboardInterrupt:
        print("\nStopping server & closing tunnel...", flush=True)
    finally:
        tunnel_process.terminate()
        flask_process.terminate()

if __name__ == "__main__":
    main()
