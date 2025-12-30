"""Static fallback data for instant trending display."""

STATIC_TRENDING = {
    "github": [
        {
            "source": "github",
            "title": "microsoft/vscode",
            "url": "https://github.com/microsoft/vscode",
            "description": "Visual Studio Code - Open Source (\"Code - OSS\")",
            "stars": 163000,
            "language": "TypeScript",
            "last_updated": "2025-12-29T00:00:00Z",
            "status": "active",
            "clone_command": "git clone https://github.com/microsoft/vscode.git",
            "readme_preview": "Visual Studio Code is a distribution of the Code - OSS repository with Microsoft specific customizations released under a traditional Microsoft product license.",
            "topics": ["editor", "typescript", "electron"]
        },
        {
            "source": "github",
            "title": "vercel/next.js",
            "url": "https://github.com/vercel/next.js",
            "description": "The React Framework for Production",
            "stars": 125000,
            "language": "JavaScript",
            "last_updated": "2025-12-29T00:00:00Z",
            "status": "active",
            "clone_command": "git clone https://github.com/vercel/next.js.git",
            "readme_preview": "Next.js is a React framework for building full-stack web applications. You use React Components to build user interfaces, and Next.js for additional features and optimizations.",
            "topics": ["react", "nextjs", "framework"]
        },
        {
            "source": "github",
            "title": "pytorch/pytorch",
            "url": "https://github.com/pytorch/pytorch",
            "description": "Tensors and Dynamic neural networks in Python with strong GPU acceleration",
            "stars": 82000,
            "language": "Python",
            "last_updated": "2025-12-29T00:00:00Z",
            "status": "active",
            "clone_command": "git clone https://github.com/pytorch/pytorch.git",
            "readme_preview": "PyTorch is a Python package that provides two high-level features: Tensor computation with strong GPU acceleration and Deep neural networks built on a tape-based autograd system.",
            "topics": ["pytorch", "machine-learning", "deep-learning"]
        }
    ],
    "huggingface": [
        {
            "source": "huggingface",
            "title": "meta-llama/Llama-3.3-70B-Instruct",
            "url": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
            "description": "Llama 3.3 multilingual large language model optimized for dialogue use cases",
            "model_type": "text-generation",
            "downloads": 500000,
            "likes": 1200,
            "spaces_url": None,
            "pipeline_tag": "text-generation"
        },
        {
            "source": "huggingface",
            "title": "Qwen/Qwen2.5-Coder-32B-Instruct",
            "url": "https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct",
            "description": "Qwen2.5-Coder is the code version of the Qwen2.5 series",
            "model_type": "text-generation",
            "downloads": 300000,
            "likes": 850,
            "spaces_url": None,
            "pipeline_tag": "text-generation"
        },
        {
            "source": "huggingface",
            "title": "black-forest-labs/FLUX.1-dev",
            "url": "https://huggingface.co/black-forest-labs/FLUX.1-dev",
            "description": "FLUX.1 [dev] is a 12 billion parameter flow-based text-to-image model",
            "model_type": "text-to-image",
            "downloads": 1000000,
            "likes": 2500,
            "spaces_url": None,
            "pipeline_tag": "text-to-image"
        }
    ],
    "reddit": [
        {
            "source": "reddit",
            "title": "What's your tech stack for 2025?",
            "url": "https://www.reddit.com/r/webdev/comments/example1",
            "subreddit": "webdev",
            "score": 450,
            "num_comments": 230,
            "created_utc": 1735344000.0,
            "selftext": "What technologies are you planning to use or learn in 2025?",
            "top_comments": [
                {
                    "author": "dev_enthusiast",
                    "score": 120,
                    "body": "Next.js 15 with TypeScript, Tailwind CSS, and tRPC for type-safe APIs",
                    "sentiment": "positive"
                }
            ],
            "community_sentiment": "positive",
            "has_warning": False,
            "warning_reason": None,
            "preview_available": True
        },
        {
            "source": "reddit",
            "title": "Best AI tools for developers in 2025",
            "url": "https://www.reddit.com/r/programming/comments/example2",
            "subreddit": "programming",
            "score": 380,
            "num_comments": 156,
            "created_utc": 1735344000.0,
            "selftext": "What AI coding assistants are you using?",
            "top_comments": [
                {
                    "author": "coder_pro",
                    "score": 95,
                    "body": "Claude and Cursor are game changers for productivity",
                    "sentiment": "positive"
                }
            ],
            "community_sentiment": "positive",
            "has_warning": False,
            "warning_reason": None,
            "preview_available": True
        },
        {
            "source": "reddit",
            "title": "Learning path for full-stack development",
            "url": "https://www.reddit.com/r/learnprogramming/comments/example3",
            "subreddit": "learnprogramming",
            "score": 520,
            "num_comments": 340,
            "created_utc": 1735344000.0,
            "selftext": "Complete roadmap for becoming a full-stack developer",
            "top_comments": [
                {
                    "author": "senior_dev",
                    "score": 180,
                    "body": "Start with HTML/CSS/JS fundamentals, then React, then Node.js with Express or FastAPI",
                    "sentiment": "positive"
                }
            ],
            "community_sentiment": "positive",
            "has_warning": False,
            "warning_reason": None,
            "preview_available": True
        }
    ]
}
