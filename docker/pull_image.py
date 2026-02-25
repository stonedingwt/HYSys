#!/usr/bin/env python3
"""
Manual Docker image puller via mirror proxies.
Downloads image layers and assembles into a Docker-loadable tar.
"""
import json
import hashlib
import os
import sys
import tarfile
import tempfile
import io
import urllib.request
import urllib.error
import ssl
import time

# Mirror proxies to try
MIRRORS = [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io",
]

IMAGE = "dataelement/mep-backend"
TAG = "v2.4.0-beta1"
OUTPUT = "mep-backend.tar"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch(url, headers=None, timeout=60):
    """Fetch URL with custom headers"""
    req = urllib.request.Request(url, headers=headers or {})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ctx)
        return resp.read(), resp.status, dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.read(), e.code, dict(e.headers)
    except Exception as e:
        return str(e).encode(), 0, {}


def get_token(mirror, image):
    """Try to get auth token from mirror"""
    # Try the mirror's own token endpoint
    token_url = f"{mirror}/token?service=registry.docker.io&scope=repository:{image}:pull"
    data, code, headers = fetch(token_url, timeout=15)
    if code == 200:
        try:
            return json.loads(data).get("token")
        except:
            pass
    
    # Try Docker Hub's auth directly through mirror
    token_url = f"{mirror}/v2/"
    data, code, headers = fetch(token_url, timeout=15)
    if code == 401:
        # Parse WWW-Authenticate header
        auth_header = headers.get("Www-Authenticate", "")
        if "realm=" in auth_header:
            import re
            realm = re.search(r'realm="([^"]+)"', auth_header)
            service = re.search(r'service="([^"]+)"', auth_header)
            if realm:
                realm_url = realm.group(1)
                svc = service.group(1) if service else ""
                auth_url = f"{realm_url}?service={svc}&scope=repository:{image}:pull"
                data2, code2, _ = fetch(auth_url, timeout=15)
                if code2 == 200:
                    try:
                        return json.loads(data2).get("token")
                    except:
                        pass
    return None


def get_manifest(mirror, image, tag, token=None):
    """Get image manifest"""
    url = f"{mirror}/v2/{image}/manifests/{tag}"
    headers = {
        "Accept": "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data, code, resp_headers = fetch(url, headers=headers, timeout=30)
    if code == 200:
        return json.loads(data), resp_headers
    return None, None


def get_manifest_list(mirror, image, tag, token=None):
    """Get manifest list (for multi-arch images)"""
    url = f"{mirror}/v2/{image}/manifests/{tag}"
    headers = {
        "Accept": "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data, code, resp_headers = fetch(url, headers=headers, timeout=30)
    if code == 200:
        return json.loads(data)
    return None


def download_blob(mirror, image, digest, token=None, output_path=None):
    """Download a blob (layer) from registry"""
    url = f"{mirror}/v2/{image}/blobs/{digest}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req = urllib.request.Request(url, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=300, context=ctx)
        if output_path:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            with open(output_path, 'wb') as f:
                while True:
                    chunk = resp.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 / total
                        print(f"\r  Downloading: {downloaded/(1024*1024):.1f}MB / {total/(1024*1024):.1f}MB ({pct:.0f}%)", end="", flush=True)
                    else:
                        print(f"\r  Downloading: {downloaded/(1024*1024):.1f}MB", end="", flush=True)
            print()
            return True
        else:
            return resp.read()
    except Exception as e:
        print(f"\n  Error downloading blob: {e}")
        return None


def main():
    print(f"Attempting to pull {IMAGE}:{TAG}")
    print("=" * 60)
    
    for mirror in MIRRORS:
        print(f"\nTrying mirror: {mirror}")
        
        # Step 1: Get auth token
        print("  Getting auth token...")
        token = get_token(mirror, IMAGE)
        if token:
            print(f"  Token obtained (length={len(token)})")
        else:
            print("  No token (trying without auth)")
        
        # Step 2: Check for manifest list (multi-arch)
        print("  Checking manifest list...")
        manifest_list = get_manifest_list(mirror, IMAGE, TAG, token)
        
        target_digest = None
        if manifest_list and manifest_list.get("manifests"):
            print(f"  Found manifest list with {len(manifest_list['manifests'])} entries")
            # Find arm64 or amd64 manifest
            for m in manifest_list["manifests"]:
                platform = m.get("platform", {})
                arch = platform.get("architecture", "")
                os_name = platform.get("os", "")
                print(f"    - {os_name}/{arch}: {m.get('digest', '')[:30]}...")
                if arch == "arm64" and os_name == "linux":
                    target_digest = m["digest"]
                    print(f"  Selected arm64 manifest: {target_digest[:30]}...")
                    break
            if not target_digest:
                # Fall back to amd64
                for m in manifest_list["manifests"]:
                    platform = m.get("platform", {})
                    if platform.get("architecture") == "amd64" and platform.get("os") == "linux":
                        target_digest = m["digest"]
                        print(f"  Selected amd64 manifest: {target_digest[:30]}...")
                        break
        
        # Step 3: Get manifest
        print("  Fetching image manifest...")
        if target_digest:
            manifest, resp_headers = get_manifest(mirror, IMAGE, target_digest, token)
        else:
            manifest, resp_headers = get_manifest(mirror, IMAGE, TAG, token)
        
        if not manifest:
            print(f"  Failed to get manifest from {mirror}")
            continue
        
        print(f"  Manifest obtained! Schema version: {manifest.get('schemaVersion')}")
        
        # Check if it's a valid v2 manifest
        config_descriptor = manifest.get("config")
        layers = manifest.get("layers", [])
        
        if not config_descriptor or not layers:
            print(f"  Invalid manifest format")
            print(f"  Keys: {list(manifest.keys())}")
            continue
        
        print(f"  Config: {config_descriptor['digest'][:30]}...")
        print(f"  Layers: {len(layers)}")
        
        # Step 4: Download everything into a temp directory
        with tempfile.TemporaryDirectory() as tmpdir:
            # Download config
            print("\n  Downloading config...")
            config_path = os.path.join(tmpdir, "config.json")
            result = download_blob(mirror, IMAGE, config_descriptor["digest"], token, config_path)
            if not result:
                print("  Failed to download config")
                continue
            
            # Download layers
            layer_files = []
            for i, layer in enumerate(layers):
                digest = layer["digest"]
                size_mb = layer.get("size", 0) / (1024 * 1024)
                print(f"\n  Layer {i+1}/{len(layers)}: {digest[:30]}... ({size_mb:.1f}MB)")
                layer_filename = f"layer_{i}.tar.gz"
                layer_path = os.path.join(tmpdir, layer_filename)
                result = download_blob(mirror, IMAGE, digest, token, layer_path)
                if not result:
                    print(f"  Failed to download layer {i+1}")
                    break
                layer_files.append(layer_filename)
            else:
                # All layers downloaded successfully!
                print(f"\n  All {len(layers)} layers downloaded!")
                
                # Step 5: Create Docker image tar
                print("  Assembling Docker image tar...")
                
                # Read config
                with open(config_path, 'r') as f:
                    config_data = f.read()
                config_digest = hashlib.sha256(config_data.encode()).hexdigest()
                config_filename = f"{config_digest}.json"
                
                # Create manifest.json for docker load
                docker_manifest = [{
                    "Config": config_filename,
                    "RepoTags": [f"{IMAGE}:{TAG}"],
                    "Layers": [f"{lf}" for lf in layer_files]
                }]
                
                # Write the tar file
                output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), OUTPUT)
                with tarfile.open(output_path, "w") as tar:
                    # Add config
                    config_info = tarfile.TarInfo(name=config_filename)
                    config_bytes = config_data.encode()
                    config_info.size = len(config_bytes)
                    tar.addfile(config_info, io.BytesIO(config_bytes))
                    
                    # Add layers
                    for lf in layer_files:
                        layer_full_path = os.path.join(tmpdir, lf)
                        tar.add(layer_full_path, arcname=lf)
                    
                    # Add manifest.json
                    manifest_json = json.dumps(docker_manifest).encode()
                    manifest_info = tarfile.TarInfo(name="manifest.json")
                    manifest_info.size = len(manifest_json)
                    tar.addfile(manifest_info, io.BytesIO(manifest_json))
                
                print(f"  Image tar created: {output_path}")
                print(f"  Size: {os.path.getsize(output_path)/(1024*1024):.1f}MB")
                print(f"\n  Load with: docker load -i {output_path}")
                return 0
        
        print(f"  Failed with mirror {mirror}, trying next...")
    
    print("\nAll mirrors failed!")
    return 1


if __name__ == "__main__":
    sys.exit(main())
