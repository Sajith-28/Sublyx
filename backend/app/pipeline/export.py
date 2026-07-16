def format_timestamp(ms: float, format_type: str = "srt") -> str:
    """
    Formats milliseconds into HH:MM:SS,mmm (SRT) or HH:MM:SS.mmm (VTT)
    """
    total_sec, msec = divmod(int(ms), 1000)
    total_min, sec = divmod(total_sec, 60)
    hours, minutes = divmod(total_min, 60)
    
    if format_type == "vtt":
        return f"{hours:02d}:{minutes:02d}:{sec:02d}.{msec:03d}"
    else:
        return f"{hours:02d}:{minutes:02d}:{sec:02d},{msec:03d}"

def to_srt(segments: list[dict]) -> str:
    """
    Generates SRT caption string from segments list.
    """
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_timestamp(seg["start_ms"], "srt")
        end = format_timestamp(seg["end_ms"], "srt")
        text = seg["caption_text"]
        
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")  # Empty line separator
        
    return "\n".join(lines)

def to_vtt(segments: list[dict]) -> str:
    """
    Generates WebVTT caption string from segments list.
    """
    lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments, 1):
        start = format_timestamp(seg["start_ms"], "vtt")
        end = format_timestamp(seg["end_ms"], "vtt")
        text = seg["caption_text"]
        
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")  # Empty line separator
        
    return "\n".join(lines)

def to_txt(segments: list[dict]) -> str:
    """
    Generates plain text transcript from segments list.
    """
    return "\n".join(seg["caption_text"] for seg in segments if seg["caption_text"])
