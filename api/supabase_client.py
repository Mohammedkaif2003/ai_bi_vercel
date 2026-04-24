import os
from supabase import create_client, Client

def get_supabase() -> Client | None:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    # In production, we should ideally use a service role key for backend operations
    # to bypass RLS if needed, or use the user's token directly.
    # For now, we will use the anon key. 
    # Important: To act on behalf of the user, we need to pass their JWT.
    
    if not url or not key:
        return None
        
    return create_client(url, key)

def get_supabase_for_user(token: str) -> Client | None:
    """Returns a Supabase client authenticated as the user providing the token."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        return None
        
    client = create_client(url, key)
    # Set the user's JWT to authenticate subsequent requests
    client.auth.set_session(access_token=token, refresh_token="")
    return client
