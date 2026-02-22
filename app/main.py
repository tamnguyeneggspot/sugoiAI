"""App entry: run crawlers and/or translation."""
import sys
import argparse
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from app.scheduler import (
    run_all_crawlers,
    run_translation,
    run_extract_hero_images,
    run_translate_title_summary,
    run_update_is_show,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="News Crawler & Translator")
    parser.add_argument(
        "command",
        nargs="?",
        default="crawl",
        choices=["crawl", "translate", "title-summary", "hero", "is-show", "all"],
        help="Command to run: crawl, translate, title-summary, hero, is-show, or all (default: crawl)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of articles to process (0 = no limit)"
    )
    parser.add_argument(
        "--size",
        type=int,
        default=800,
        help="Image size for hero images (default: 800)"
    )
    parser.add_argument(
        "--loop",
        nargs="?",
        const=-1,
        type=int,
        default=0,
        metavar="N",
        help="With 'all': run N cycles (default: 1). Use --loop without N for infinite loop."
    )
    
    args = parser.parse_args()
    
    if args.command == "crawl":
        n = run_all_crawlers()
        print(f"Saved {n} articles to MongoDB.")
    
    elif args.command == "translate":
        n = run_translation(limit=args.limit)
        print(f"Translated {n} articles.")

    elif args.command == "title-summary":
        n = run_translate_title_summary(limit=args.limit)
        print(f"Translated title/summary for {n} articles.")
    
    elif args.command == "hero":
        n = run_extract_hero_images(limit=args.limit, size=args.size)
        print(f"Extracted hero images for {n} articles.")

    elif args.command == "is-show":
        n = run_update_is_show(limit=args.limit)
        print(f"Set isShow=True for {n} articles.")

    elif args.command == "all":
        cycles = args.loop  # 0 = một vòng, -1 = vô hạn, N > 0 = N vòng
        round_num = 0
        while True:
            round_num += 1
            print("=" * 50)
            print(f"  VÒNG {round_num}")
            print("=" * 50)
            n_crawl = run_all_crawlers()
            print(f"Saved {n_crawl} articles to MongoDB.")
            print("-" * 40)
            n_translate = run_translation(limit=args.limit)
            print(f"Translated {n_translate} articles.")
            print("-" * 40)
            n_title_summary = run_translate_title_summary(limit=args.limit)
            print(f"Translated title/summary for {n_title_summary} articles.")
            print("-" * 40)
            n_hero = run_extract_hero_images(limit=args.limit, size=args.size)
            print(f"Extracted hero images for {n_hero} articles.")
            print("-" * 40)
            n_ishow = run_update_is_show(limit=args.limit)
            print(f"Set isShow=True for {n_ishow} articles.")
            if cycles == 0:
                break
            if cycles > 0 and round_num >= cycles:
                break
            print("\nChờ 5s rồi chạy vòng tiếp... (Ctrl+C để dừng)\n")
            time.sleep(5)


if __name__ == "__main__":
    main()
