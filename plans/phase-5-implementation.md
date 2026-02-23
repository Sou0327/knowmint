# Phase 5 Implementation Plan - KnowMint

> Multi-chain Support, Dashboard Enhancement, and Advanced Features

## Executive Summary

### Current State Analysis

Based on codebase exploration:

**Phase 5.1 (User Dashboard)**: 85% complete
- ✅ Dashboard overview with stats (`/dashboard`)
- ✅ Listings management (`/dashboard/listings`)
- ✅ Sales analytics with charts (`/dashboard/sales`)
- ✅ API key management (`/dashboard/api-keys`)
- ✅ Profile editing (`/profile`)
- ⚠️ Purchase history page exists but only redirects to `/library`

**Phase 5.2 (Multi-chain)**: 0% complete
- Database schema already supports ETH, Base, Ethereum chains
- No EVM wallet libraries installed
- Solana implementation can serve as architectural reference

**Phase 5.3 (Additional Features)**: 0% complete
- No favorites, follow, notification, or recommendation systems

### Implementation Priority

1. **High Priority**: 5.2 Multi-chain (core value proposition)
2. **Medium Priority**: 5.1 Dashboard completion (purchase history view)
3. **Low Priority**: 5.3 Additional features (engagement optimization)

---

## Task Breakdown

### 5.1 User Dashboard Completion (2 tasks)

#### Task 5.1.1: Dedicated Purchase History Dashboard View
**Status**: `cc:TODO`  
**Priority**: Medium  
**Estimated Effort**: 2-3 hours

**Current Issue**:
- `/dashboard/purchases` redirects to `/library`
- No dashboard-specific purchase analytics

**Requirements**:
1. Create dedicated purchase history view in dashboard
2. Show purchase timeline with filters (date range, content type, token)
3. Display spending summary by token (SOL/USDC/ETH)
4. Show purchase statistics (total items, total spent, average price)
5. Link to full content in library

**Implementation**:
- **File to modify**: `src/app/(main)/dashboard/purchases/page.tsx`
- **New query function**: `src/lib/dashboard/queries.ts::getPurchaseHistory()`
- **Reuse components**: `Card`, `Badge`, `StatsCard`, existing dashboard layout
- **Database queries**:
  ```typescript
  // Purchase timeline
  .from("transactions")
  .select("*, knowledge_item:knowledge_items(title, content_type)")
  .eq("buyer_id", user.id)
  .eq("status", "confirmed")
  .order("created_at", { ascending: false })
  
  // Spending stats by token
  .from("transactions")
  .select("amount, token")
  .eq("buyer_id", user.id)
  .eq("status", "confirmed")
  ```

**Dependencies**: None

---

#### Task 5.1.2: Dashboard Settings Page
**Status**: `cc:TODO`  
**Priority**: Low  
**Estimated Effort**: 1-2 hours

**Current Issue**:
- `/dashboard/settings` exists in navigation but may need content
- Profile editing is separate at `/profile`

**Requirements**:
1. Verify if settings page exists and is functional
2. If empty, add dashboard-specific settings:
   - Notification preferences (future-ready)
   - Privacy settings (public profile visibility)
   - Dashboard layout preferences
3. Or redirect to `/profile` with clear UX

**Implementation**:
- **File to check/modify**: `src/app/(main)/dashboard/settings/page.tsx`
- **Approach**: Either implement settings or improve redirect UX

**Dependencies**: None

---

### 5.2 Multi-chain Support (7 tasks)

#### Task 5.2.1: Install EVM Dependencies
**Status**: `cc:TODO`  
**Priority**: High  
**Estimated Effort**: 30 minutes

**Requirements**:
1. Install viem for EVM interactions (modern, lightweight)
2. Install wagmi for React wallet integration
3. Install EVM wallet connectors (MetaMask, Coinbase Wallet, WalletConnect)

**Commands**:
```bash
npm install viem wagmi @wagmi/core @wagmi/connectors
```

**Why viem over ethers.js**:
- Smaller bundle size (tree-shakeable)
- Better TypeScript support
- Modern API design
- Official recommendation for new projects

**Dependencies**: None

---

#### Task 5.2.2: Create EVM Wallet Context
**Status**: `cc:TODO`  
**Priority**: High  
**Estimated Effort**: 3-4 hours

**Requirements**:
1. Create `WalletContext` for multi-chain support
2. Support both Solana and EVM chains simultaneously
3. Expose active chain, wallet addresses, connection methods
4. Handle chain switching (Solana ↔ Base ↔ Ethereum)

**Implementation**:
- **New file**: `src/contexts/WalletContext.tsx`
- **New types**: `src/types/wallet.types.ts`
  ```typescript
  type ChainType = "solana" | "base" | "ethereum";
  type WalletState = {
    activeChain: ChainType;
    solanaAddress?: string;
    evmAddress?: string;
    isConnected: boolean;
    switchChain: (chain: ChainType) => Promise<void>;
  };
  ```
- **Integrate**:
  - Wrap existing Solana `WalletProvider`
  - Add wagmi `WagmiProvider` for EVM
  - Update `src/app/layout.tsx` to include both providers

**Architecture**:
```
WalletContext (manages active chain)
├── SolanaWalletProvider (existing)
└── WagmiProvider (new)
    ├── MetaMaskConnector
    ├── CoinbaseWalletConnector
    └── WalletConnectConnector
```

**Dependencies**: Task 5.2.1

---

#### Task 5.2.3: Update WalletButton for Multi-chain
**Status**: `cc:TODO`  
**Priority**: High  
**Estimated Effort**: 2-3 hours

**Requirements**:
1. Add chain selector UI (dropdown or tabs)
2. Show appropriate wallet button based on active chain
3. Display connected address for each chain
4. Handle disconnection per chain

**Implementation**:
- **File to modify**: `src/components/features/WalletButton.tsx`
- **UI Design**:
  ```
  [ Solana ▼ ] [ Connect Wallet ]
     |
     ├─ Solana (Phantom, Solflare)
     ├─ Base (MetaMask, Coinbase)
     └─ Ethereum (MetaMask, WalletConnect)
  ```
- **Reuse**: Existing Solana wallet UI patterns
- **New component**: `ChainSelector.tsx` (dropdown with chain logos)

**Dependencies**: Task 5.2.2

---

#### Task 5.2.4: Create EVM Payment Module
**Status**: `cc:TODO`  
**Priority**: High  
**Estimated Effort**: 4-5 hours

**Requirements**:
1. Implement ETH transfer on Base/Ethereum
2. Mirror Solana payment architecture:
   - Transaction construction
   - User confirmation
   - Blockchain submission
   - Transaction monitoring
3. Handle gas estimation and fee display
4. Support mainnet and testnet

**Implementation**:
- **New files**:
  - `src/lib/evm/connection.ts` - RPC provider setup
  - `src/lib/evm/payment.ts` - ETH transfer logic
  - `src/lib/evm/confirm.ts` - Transaction confirmation
- **Reference**: `src/lib/solana/payment.ts` (existing pattern)
- **viem API**:
  ```typescript
  import { createWalletClient, createPublicClient, http } from 'viem';
  import { base, mainnet } from 'viem/chains';
  
  // Send ETH
  const hash = await walletClient.sendTransaction({
    to: sellerAddress,
    value: parseEther(amount.toString()),
    chain: base,
  });
  
  // Confirm transaction
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  ```

**Gas Fee Handling**:
- Estimate gas before transaction
- Show estimated fee to user
- Handle user rejection of high fees

**Dependencies**: Task 5.2.2

---

#### Task 5.2.5: Update Purchase Flow for Multi-chain
**Status**: `cc:TODO`  
**Priority**: High  
**Estimated Effort**: 3-4 hours

**Requirements**:
1. Update `PurchaseModal` to support chain selection
2. Display price in all supported tokens (SOL/USDC/ETH)
3. Route to appropriate payment module based on selected chain
4. Show chain-specific confirmation UI
5. Handle chain-specific errors (insufficient balance, gas, etc.)

**Implementation**:
- **File to modify**: `src/components/features/PurchaseModal.tsx`
- **UI Changes**:
  ```
  Price: 0.1 SOL  |  0.5 ETH
  
  Pay with: [ Solana ▼ ]
             ├─ Solana (0.1 SOL)
             ├─ Base (0.5 ETH + ~$0.10 gas)
             └─ Ethereum (0.5 ETH + ~$2.50 gas)
  
  [Confirm Purchase]
  ```
- **Backend API**: `src/app/api/v1/knowledge/[id]/purchase/route.ts`
  - Add chain/token validation
  - Route to appropriate on-chain verification

**Dependencies**: Task 5.2.4

---

#### Task 5.2.6: Implement On-chain Verification for EVM
**Status**: `cc:TODO`  
**Priority**: High  
**Estimated Effort**: 3-4 hours

**Requirements**:
1. Verify EVM transaction on-chain after submission
2. Check recipient, amount, status
3. Prevent replay attacks (tx_hash uniqueness already enforced)
4. Update transaction status to `confirmed`

**Implementation**:
- **New file**: `src/lib/evm/verify.ts`
- **Verification steps**:
  ```typescript
  // 1. Fetch transaction receipt
  const receipt = await publicClient.getTransactionReceipt({ hash });
  
  // 2. Verify status (1 = success)
  if (receipt.status !== 'success') throw new Error('Transaction failed');
  
  // 3. Verify recipient
  if (receipt.to.toLowerCase() !== sellerAddress.toLowerCase()) {
    throw new Error('Invalid recipient');
  }
  
  // 4. Verify amount (decode value from receipt)
  const value = receipt.value;
  if (value < expectedAmount) throw new Error('Insufficient amount');
  ```
- **Reference**: `src/lib/solana/confirm.ts` (existing pattern)
- **Backend integration**: Update purchase API route to call EVM verification

**Security considerations**:
- Use read-only RPC providers (no private keys on backend)
- Verify confirmations (1 for Base, 12 for Ethereum mainnet)
- Check transaction finality before marking as confirmed

**Dependencies**: Task 5.2.4

---

#### Task 5.2.7: Add Chain Indicator in UI
**Status**: `cc:TODO`  
**Priority**: Medium  
**Estimated Effort**: 1-2 hours

**Requirements**:
1. Show chain/token badges on knowledge cards
2. Display transaction chain in purchase history
3. Add chain filters in search/listing pages

**Implementation**:
- **Files to modify**:
  - `src/components/features/KnowledgeCard.tsx` - add chain badge
  - `src/app/(main)/dashboard/sales/page.tsx` - show chain in transactions
  - `src/app/(main)/dashboard/purchases/page.tsx` - show chain in purchases
- **New component**: `ChainBadge.tsx`
  ```typescript
  <ChainBadge chain="base" />   // Shows Base logo + name
  <ChainBadge chain="solana" /> // Shows Solana logo + name
  ```

**Dependencies**: Task 5.2.5

---

### 5.3 Additional Features (5 tasks)

#### Task 5.3.1: Favorites / Watchlist
**Status**: `cc:TODO`  
**Priority**: Low  
**Estimated Effort**: 4-5 hours

**Requirements**:
1. Allow users to favorite knowledge items
2. Show favorites in a dedicated page (`/favorites`)
3. Show favorite count on knowledge cards
4. Add "Add to Favorites" button on detail page

**Database Migration**:
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, knowledge_item_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_item ON favorites(knowledge_item_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select" ON favorites
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "favorites_insert" ON favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "favorites_delete" ON favorites
  FOR DELETE USING (user_id = auth.uid());
```

**Implementation**:
- **New API route**: `src/app/api/v1/knowledge/[id]/favorite/route.ts`
- **New page**: `src/app/(main)/favorites/page.tsx`
- **New component**: `FavoriteButton.tsx` (heart icon, toggle on/off)

**Dependencies**: None

---

#### Task 5.3.2: Follow Sellers
**Status**: `cc:TODO`  
**Priority**: Low  
**Estimated Effort**: 4-5 hours

**Requirements**:
1. Allow users to follow sellers
2. Show follower count on seller profile
3. Show followed sellers in a dedicated page (`/following`)
4. Notify on new listings from followed sellers (future)

**Database Migration**:
```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, followed_id),
  CHECK (follower_id != followed_id) -- Can't follow self
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_followed ON follows(followed_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select" ON follows FOR SELECT USING (true); -- Public
CREATE POLICY "follows_insert" ON follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON follows
  FOR DELETE USING (follower_id = auth.uid());

-- Add follower count to profiles (derived)
ALTER TABLE profiles ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION update_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.followed_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = follower_count - 1 WHERE id = OLD.followed_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_follower_count
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follower_count();
```

**Implementation**:
- **New API route**: `src/app/api/v1/profiles/[id]/follow/route.ts`
- **New page**: `src/app/(main)/following/page.tsx`
- **New component**: `FollowButton.tsx`
- **Update**: `SellerCard.tsx` to show follower count and follow button

**Dependencies**: None

---

#### Task 5.3.3: Notifications System
**Status**: `cc:TODO`  
**Priority**: Low  
**Estimated Effort**: 6-8 hours

**Requirements**:
1. Notify sellers on purchases
2. Notify buyers on reviews
3. Notify on new listings from followed sellers (if 5.3.2 done)
4. Show notification bell icon in header
5. Mark notifications as read

**Database Migration**:
```sql
CREATE TYPE notification_type AS ENUM (
  'purchase_completed',
  'review_received',
  'new_listing_from_followed',
  'listing_suspended'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
```

**Implementation**:
- **New API routes**:
  - `src/app/api/v1/notifications/route.ts` (list, mark as read)
  - `src/app/api/v1/notifications/[id]/read/route.ts`
- **New page**: `src/app/(main)/notifications/page.tsx`
- **New component**: `NotificationBell.tsx` (in Header, shows unread count)
- **Notification triggers**:
  - Webhook system (existing `webhook_subscriptions` table)
  - Or direct insertion in transaction/review creation

**Dependencies**: Optional (Task 5.3.2 for follow notifications)

---

#### Task 5.3.4: Recommendation System
**Status**: `cc:TODO`  
**Priority**: Low  
**Estimated Effort**: 6-8 hours

**Requirements**:
1. Recommend knowledge based on:
   - Purchase history (similar items)
   - View history (collaborative filtering)
   - Category preferences
   - Popular items in followed categories
2. Show recommendations on homepage and knowledge detail page
3. Simple algorithm (no ML required for MVP)

**Database Changes**:
```sql
-- Track view history (for recommendations)
CREATE TABLE view_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_view_history_user ON view_history(user_id, viewed_at DESC);
CREATE INDEX idx_view_history_item ON view_history(knowledge_item_id);

ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_history_select" ON view_history
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "view_history_insert" ON view_history
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

**Implementation**:
- **New file**: `src/lib/recommendations/queries.ts`
- **Algorithm (simple collaborative filtering)**:
  1. Find users who purchased/viewed similar items
  2. Recommend items those users also purchased/viewed
  3. Weight by rating and recency
  4. Filter out already purchased items
- **New API route**: `src/app/api/v1/knowledge/recommendations/route.ts`
- **Update homepage**: Add "Recommended for You" section

**Dependencies**: None

---

#### Task 5.3.5: Seller Rankings
**Status**: `cc:TODO`  
**Priority**: Low  
**Estimated Effort**: 3-4 hours

**Requirements**:
1. Show top sellers by:
   - Total sales
   - Total revenue
   - Average rating
   - Follower count (if 5.3.2 done)
2. Create `/rankings` page
3. Add ranking badges to top sellers (Top 10, Top 50, etc.)

**Implementation**:
- **New page**: `src/app/(main)/rankings/page.tsx`
- **Query**:
  ```sql
  -- Top sellers by revenue
  SELECT 
    p.id, p.display_name, p.avatar_url,
    COUNT(DISTINCT t.id) as sales_count,
    SUM(CASE WHEN t.token = 'SOL' THEN t.amount ELSE 0 END) as revenue_sol,
    SUM(CASE WHEN t.token = 'ETH' THEN t.amount ELSE 0 END) as revenue_eth,
    AVG(ki.average_rating) as avg_rating
  FROM profiles p
  JOIN knowledge_items ki ON ki.seller_id = p.id
  JOIN transactions t ON t.seller_id = p.id AND t.status = 'confirmed'
  GROUP BY p.id
  ORDER BY revenue_sol + (revenue_eth * eth_to_sol_rate) DESC
  LIMIT 100;
  ```
- **New component**: `RankingBadge.tsx` (Gold/Silver/Bronze for top 3)

**Dependencies**: Optional (Task 5.3.2 for follower-based ranking)

---

## Database Migrations Summary

### Required for 5.2 (Multi-chain)
None - schema already supports ETH, Base, Ethereum

### Required for 5.3 (Additional Features)

**5.3.1 Favorites**:
```sql
CREATE TABLE favorites (user_id, knowledge_item_id, created_at);
```

**5.3.2 Follow**:
```sql
CREATE TABLE follows (follower_id, followed_id, created_at);
ALTER TABLE profiles ADD COLUMN follower_count INTEGER;
```

**5.3.3 Notifications**:
```sql
CREATE TYPE notification_type AS ENUM (...);
CREATE TABLE notifications (user_id, type, title, message, is_read, created_at);
```

**5.3.4 Recommendations**:
```sql
CREATE TABLE view_history (user_id, knowledge_item_id, viewed_at);
```

**5.3.5 Rankings**:
No new tables (uses existing transactions, reviews, profiles)

---

## Implementation Sequence

### Phase A: Multi-chain Core (Week 1)
**Goal**: Enable ETH payments on Base and Ethereum

1. Task 5.2.1: Install EVM dependencies (30 min)
2. Task 5.2.2: Create EVM wallet context (4 hours)
3. Task 5.2.3: Update WalletButton (3 hours)
4. Task 5.2.4: Create EVM payment module (5 hours)
5. Task 5.2.5: Update purchase flow (4 hours)
6. Task 5.2.6: Implement on-chain verification (4 hours)

**Total**: ~20 hours

### Phase B: Multi-chain Polish (Week 1)
**Goal**: Complete multi-chain UX

7. Task 5.2.7: Add chain indicators (2 hours)
8. Task 5.1.1: Purchase history dashboard (3 hours)

**Total**: ~5 hours

### Phase C: Social Features (Week 2-3)
**Goal**: Engagement and retention

9. Task 5.3.1: Favorites/Watchlist (5 hours)
10. Task 5.3.2: Follow sellers (5 hours)
11. Task 5.3.3: Notifications (8 hours)

**Total**: ~18 hours

### Phase D: Discovery Features (Week 3-4)
**Goal**: Improve content discovery

12. Task 5.3.4: Recommendation system (8 hours)
13. Task 5.3.5: Seller rankings (4 hours)
14. Task 5.1.2: Dashboard settings (2 hours)

**Total**: ~14 hours

---

## Testing Strategy

### Unit Tests
- EVM payment module (transaction construction, amount validation)
- Wallet context (chain switching, address management)
- Recommendation algorithm (collaborative filtering logic)

### Integration Tests
- End-to-end purchase flow (Solana + Base + Ethereum)
- On-chain verification (mock blockchain responses)
- Notification triggers (webhook events)

### Manual Testing Checklist

**Multi-chain**:
- [ ] Connect MetaMask wallet on Base testnet
- [ ] Purchase knowledge with ETH on Base
- [ ] Verify transaction on-chain (Basescan)
- [ ] Switch to Ethereum mainnet
- [ ] Check gas fee estimation accuracy
- [ ] Test wallet disconnection and reconnection

**Dashboard**:
- [ ] View purchase history with filters
- [ ] Check spending stats by token
- [ ] Verify dashboard settings persistence

**Social Features**:
- [ ] Add item to favorites
- [ ] Follow a seller
- [ ] Receive purchase notification (as seller)
- [ ] Mark notification as read
- [ ] Unfollow seller

**Recommendations**:
- [ ] View recommended items on homepage
- [ ] Verify recommendations change based on purchase history
- [ ] Check "Similar Items" on detail page

---

## UI/UX Design Approach

**Use `document-skills:frontend-design` for**:
1. Multi-chain wallet selector dropdown (Task 5.2.3)
2. Chain indicator badges (Task 5.2.7)
3. Purchase history dashboard layout (Task 5.1.1)
4. Notification bell UI and notification list (Task 5.3.3)
5. Recommendation carousel on homepage (Task 5.3.4)
6. Seller rankings page layout (Task 5.3.5)

**Design consistency**:
- Follow existing Tailwind CSS v4 patterns
- Use existing components: Card, Badge, Button, Modal
- Dark mode support (all new components)
- Accessibility: aria-labels, keyboard navigation

---

## Codex Review Strategy

**After completing each phase**:

```bash
# Phase A (Multi-chain Core)
mcp__codex__codex --scope security,performance,quality \
  --files "src/lib/evm/**/*.ts,src/contexts/WalletContext.tsx"

# Phase B (Multi-chain Polish)
mcp__codex__codex --scope security,quality \
  --files "src/components/features/WalletButton.tsx,src/app/(main)/dashboard/purchases/page.tsx"

# Phase C (Social Features)
mcp__codex__codex --scope security,performance \
  --files "src/app/api/v1/notifications/**/*.ts,supabase/migrations/*favorites*.sql"

# Phase D (Discovery Features)
mcp__codex__codex --scope performance,quality \
  --files "src/lib/recommendations/**/*.ts,src/app/(main)/rankings/page.tsx"
```

**Critical review areas**:
- **EVM security**: Transaction verification, amount validation, gas estimation
- **RLS policies**: Ensure favorites/follows/notifications respect user privacy
- **Performance**: Recommendation queries, notification pagination
- **XSS prevention**: User-generated content in notifications

---

## Risk Assessment

### High Risk
- **EVM transaction verification**: Complex, requires thorough testing
  - Mitigation: Start with Base testnet, comprehensive unit tests
- **Gas fee volatility**: User frustration with high Ethereum fees
  - Mitigation: Clear fee display, recommend Base for lower fees

### Medium Risk
- **Wallet compatibility**: Different wallets, different behaviors
  - Mitigation: Test with MetaMask, Coinbase Wallet, WalletConnect
- **Notification spam**: Too many notifications annoy users
  - Mitigation: User preferences, digest mode, mute options

### Low Risk
- **Recommendation quality**: Simple algorithm may not be very accurate
  - Mitigation: Start simple, iterate based on user feedback
- **Favorites/follow performance**: Large datasets slow queries
  - Mitigation: Proper indexing, pagination

---

## Success Metrics

### Phase 5.2 (Multi-chain)
- [ ] 30%+ of purchases use Base/Ethereum within first month
- [ ] <1% transaction verification errors
- [ ] Gas fee estimation within 10% of actual cost

### Phase 5.3 (Additional Features)
- [ ] 20%+ of users favorite at least one item
- [ ] 10%+ of users follow at least one seller
- [ ] 50%+ of notifications opened within 24 hours
- [ ] 15%+ increase in knowledge discovery via recommendations

---

## Open Questions

1. **Multi-chain pricing**: Should sellers set separate prices for ETH vs SOL, or use automatic conversion?
   - Recommendation: Start with manual per-token pricing for seller control
   
2. **Gas fee responsibility**: Should marketplace subsidize gas fees on Base?
   - Recommendation: No subsidy for MVP; monitor user feedback
   
3. **Notification channels**: Email notifications in addition to in-app?
   - Recommendation: Start in-app only; add email in later phase
   
4. **Recommendation algorithm**: Use ML or simple collaborative filtering?
   - Recommendation: Simple CF for MVP; evaluate ML if needed later

---

## Dependencies

### External Libraries
- **viem**: ^2.x (EVM interactions)
- **wagmi**: ^2.x (React wallet hooks)
- **@wagmi/connectors**: ^5.x (wallet connectors)

### Internal Prerequisites
- Phase 1-4 complete (database schema, Solana payment, API foundation)
- Supabase RLS policies tested and secure
- Existing UI components (Card, Badge, Button, Modal) functional

---

## Rollout Plan

### Testnet Rollout (Week 1-2)
1. Deploy multi-chain on Base Sepolia testnet
2. Internal testing with test ETH
3. Beta testers (5-10 users) try Base purchases
4. Monitor Basescan for transaction success rate

### Mainnet Rollout (Week 3)
1. Deploy to Base mainnet
2. Announce multi-chain support to existing users
3. Monitor error rates, gas fee complaints
4. Hotfix any issues within 24 hours

### Feature Rollout (Week 4-6)
1. Enable favorites/follow (Week 4)
2. Enable notifications (Week 5)
3. Enable recommendations/rankings (Week 6)
4. A/B test recommendation algorithm variants

---

## Post-Launch Monitoring

### Key Metrics to Track
- Multi-chain adoption rate (SOL vs ETH vs Base)
- Transaction success rate per chain
- Average gas fee per chain
- Notification open rate
- Recommendation click-through rate
- Favorite/follow engagement

### Alerts to Set
- Transaction verification failure rate >1%
- Gas estimation error >20%
- Notification delivery failure rate >5%
- Database query latency >2 seconds

---

## Critical Files for Implementation

### Phase 5.2 (Multi-chain) - Top 5 Files

1. **`src/contexts/WalletContext.tsx`** (NEW)
   - Reason: Central multi-chain wallet management, integrates Solana + EVM providers

2. **`src/lib/evm/payment.ts`** (NEW)
   - Reason: Core EVM payment logic, mirrors Solana payment architecture

3. **`src/components/features/WalletButton.tsx`** (MODIFY)
   - Reason: User-facing wallet connection UI, must support chain selection

4. **`src/lib/evm/verify.ts`** (NEW)
   - Reason: On-chain transaction verification for security, prevents fraud

5. **`src/components/features/PurchaseModal.tsx`** (MODIFY)
   - Reason: Purchase flow orchestration, routes to correct payment module

### Phase 5.3 (Additional Features) - Top 5 Files

1. **`supabase/migrations/20260216000005_social_features.sql`** (NEW)
   - Reason: Database schema for favorites, follows, notifications

2. **`src/lib/recommendations/queries.ts`** (NEW)
   - Reason: Recommendation algorithm, affects content discovery

3. **`src/app/api/v1/notifications/route.ts`** (NEW)
   - Reason: Notification delivery API, critical for user engagement

4. **`src/components/dashboard/NotificationBell.tsx`** (NEW)
   - Reason: Real-time notification UI, shown in header globally

5. **`src/app/(main)/dashboard/purchases/page.tsx`** (MODIFY)
   - Reason: Purchase history dashboard, completes Phase 5.1

---

## Conclusion

Phase 5 implementation focuses on **multi-chain expansion** as the highest priority, followed by **dashboard completion** and **engagement features**. The multi-chain architecture leverages modern tools (viem, wagmi) and mirrors the proven Solana implementation for consistency. Social and discovery features are prioritized for user retention post-MVP launch.

Total estimated effort: **57 hours** (~2 sprints)

**Next steps**: 
1. Review this plan with stakeholders
2. Confirm multi-chain pricing strategy (manual vs automatic conversion)
3. Begin Phase A (Multi-chain Core) implementation
4. Schedule Codex review after each phase
