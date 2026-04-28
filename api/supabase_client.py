import os
from supabase import create_client, Client

def get_supabase() -> Client:
    """Returns a Supabase client initialized with the service role key.
    This client has full access to the database, bypassing RLS.
    """
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    # Use service role key for backend operations to bypass RLS
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise RuntimeError("Supabase environment variables (URL/Key) are missing.")
        
    return create_client(url, key)

def get_supabase_for_user(token: str) -> Client:
    """Returns a Supabase client authenticated as the user providing the token.
    This client respects RLS based on the user's permissions.
    """
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    # CRITICAL: Must use the Anon key here, NOT the service role key.
    # Using a service role key with a user token can cause 'Invalid API key' errors.
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise RuntimeError("Supabase environment variables (URL/Key) are missing.")
        
    client = create_client(url, key)
    # Set the user's JWT to authenticate subsequent requests
    client.auth.set_session(access_token=token, refresh_token="")
    return client
