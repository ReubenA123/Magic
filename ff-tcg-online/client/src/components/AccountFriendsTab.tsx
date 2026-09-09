import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api/rest';
import { Account, FriendshipEntry } from '../api/accountTypes';
import Avatar from './Avatar';

/** One row shape shared by the friends list, incoming, and outgoing
 * sections - only the action button(s) differ between them. */
function PersonRow({ user, children }: { user: Account; children: React.ReactNode }) {
  return (
    <div className="account-friend-row">
      <Avatar avatar={user.avatar} size={28} />
      <span className="account-friend-row-name">
        {user.username} <span className="account-tab-hint">#{user.friendCode}</span>
      </span>
      <div className="account-friend-row-actions">{children}</div>
    </div>
  );
}

export default function AccountFriendsTab() {
  const [friends, setFriends] = useState<FriendshipEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendshipEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);

  function refresh() {
    Promise.all([api.get<{ friends: FriendshipEntry[] }>('/friends'), api.get<{ incoming: FriendshipEntry[]; outgoing: FriendshipEntry[] }>('/friends/requests')])
      .then(([friendsRes, requestsRes]) => {
        setFriends(friendsRes.friends);
        setIncoming(requestsRes.incoming);
        setOutgoing(requestsRes.outgoing);
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load friends.'));
  }

  useEffect(refresh, []);

  // Debounced search-as-you-type - a fresh keystroke cancels whatever
  // lookup was still in flight for the previous one, so a slow response to
  // an early partial query can't land after (and stomp) a later one's results.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get<{ users: Account[] }>(`/friends/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => {
          if (!cancelled) setResults(res.users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That didn’t work - try again.');
    }
  }

  const pendingWithIds = new Set([...incoming, ...outgoing].map((r) => r.otherUser.id));
  const friendIds = new Set(friends.map((f) => f.otherUser.id));

  return (
    <div className="account-friends-tab">
      <div className="account-friends-search">
        <input placeholder="Find someone by username or friend code…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {searching && <span className="account-tab-hint">Searching…</span>}
        {results.length > 0 && (
          <div className="account-friend-search-results">
            {results.map((person) => (
              <PersonRow key={person.id} user={person}>
                {friendIds.has(person.id) ? (
                  <span className="account-tab-hint">Already friends</span>
                ) : pendingWithIds.has(person.id) ? (
                  <span className="account-tab-hint">Request pending</span>
                ) : (
                  <button
                    className="card-action-button secondary"
                    onClick={() => handleAction(() => api.post('/friends/requests', { userId: person.id }))}
                  >
                    Add
                  </button>
                )}
              </PersonRow>
            ))}
          </div>
        )}
      </div>

      {error && <p className="account-tab-error">{error}</p>}
      {!loaded && <p className="account-tab-hint">Loading…</p>}

      {loaded && incoming.length > 0 && (
        <section className="account-friends-section">
          <h3>Friend requests</h3>
          {incoming.map((req) => (
            <PersonRow key={req.id} user={req.otherUser}>
              <button className="card-action-button secondary" onClick={() => handleAction(() => api.post(`/friends/requests/${req.id}/accept`))}>
                Accept
              </button>
              <button className="card-action-button secondary" onClick={() => handleAction(() => api.delete(`/friends/requests/${req.id}`))}>
                Decline
              </button>
            </PersonRow>
          ))}
        </section>
      )}

      {loaded && outgoing.length > 0 && (
        <section className="account-friends-section">
          <h3>Sent requests</h3>
          {outgoing.map((req) => (
            <PersonRow key={req.id} user={req.otherUser}>
              <button className="card-action-button secondary" onClick={() => handleAction(() => api.delete(`/friends/requests/${req.id}`))}>
                Cancel
              </button>
            </PersonRow>
          ))}
        </section>
      )}

      {loaded && (
        <section className="account-friends-section">
          <h3>Friends {friends.length > 0 ? `(${friends.length})` : ''}</h3>
          {friends.length === 0 ? (
            <p className="account-tab-hint">No friends added yet - search for someone above.</p>
          ) : (
            friends.map((friend) => (
              <PersonRow key={friend.id} user={friend.otherUser}>
                <button className="card-action-button secondary" onClick={() => handleAction(() => api.delete(`/friends/requests/${friend.id}`))}>
                  Unfriend
                </button>
              </PersonRow>
            ))
          )}
        </section>
      )}
    </div>
  );
}
