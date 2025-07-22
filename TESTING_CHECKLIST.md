# Commission Tracker Testing Checklist

## Core Functionality Tests

### 1. Policy Management
- [ ] **Add Policy**
  - [ ] Can add policy with all required fields
  - [ ] Carrier dropdown populates correctly
  - [ ] Product dropdown updates based on carrier selection
  - [ ] Commission rate calculates correctly based on tenure
  - [ ] Date fields accept valid dates
  - [ ] Validates required fields
  - [ ] Handles empty/invalid data gracefully

- [ ] **Edit Policy**
  - [ ] Edit modal opens with pre-populated data
  - [ ] Can modify all fields
  - [ ] Carrier/product dropdowns work in edit mode
  - [ ] Commission recalculates on tenure/rate changes
  - [ ] Saves changes correctly
  - [ ] Handles concurrent edits

- [ ] **Delete Policy**
  - [ ] Delete confirmation modal appears
  - [ ] Can cancel deletion
  - [ ] Actually deletes policy from database
  - [ ] Updates UI after deletion
  - [ ] Handles deletion of non-existent policies

### 2. Filtering and Search
- [ ] **Status Filter**
  - [ ] "All Statuses" shows all policies
  - [ ] "Active" shows only active policies
  - [ ] "Pending" shows only pending policies
  - [ ] "Cancelled" shows only cancelled policies

- [ ] **Date Range Filter**
  - [ ] "All Time" shows all policies
  - [ ] "This Month" shows current month policies
  - [ ] "This Quarter" shows current quarter policies
  - [ ] "This Year" shows current year policies
  - [ ] "Custom Range" works with start/end dates
  - [ ] Handles edge dates (beginning/end of periods)

- [ ] **Search Functionality**
  - [ ] Searches by client name
  - [ ] Searches by carrier
  - [ ] Searches by policy number
  - [ ] Searches by product
  - [ ] Case-insensitive search
  - [ ] Partial matches work
  - [ ] Special characters in search

### 3. Commission Pipeline
- [ ] **Payment Calendar Integration**
  - [ ] Shows correct next payment date
  - [ ] Calculates expected commission amounts
  - [ ] Displays policies in correct payment periods
  - [ ] Handles policies across different periods
  - [ ] Shows days until payment correctly

- [ ] **Pipeline View**
  - [ ] Lists upcoming payment periods
  - [ ] Shows correct commission amounts per period
  - [ ] Policy details modal works
  - [ ] Handles empty periods

### 4. Insights Dashboard
- [ ] **Date Filtering**
  - [ ] All date range options work correctly
  - [ ] Custom date range functions properly
  - [ ] Shows policy count accurately

- [ ] **Statistics Accuracy**
  - [ ] Total commission calculates correctly
  - [ ] Total premium sums properly
  - [ ] Next payment amount is accurate
  - [ ] Conversion rate calculates correctly
  - [ ] Active policies count is correct

- [ ] **Charts and Visualizations**
  - [ ] Monthly trends display correctly
  - [ ] Product mix chart shows accurate data
  - [ ] Carrier breakdown is correct
  - [ ] Charts handle zero/empty data

### 5. Agent Profile Management
- [ ] **Profile Creation**
  - [ ] Can create new agent profile
  - [ ] Required fields validation
  - [ ] Date fields work correctly
  - [ ] Specializations array handling

- [ ] **Profile Updates**
  - [ ] Can modify existing profile
  - [ ] Changes save correctly
  - [ ] Handles concurrent updates

### 6. Slack Integration
- [ ] **Quick Post**
  - [ ] Sends basic policy notification
  - [ ] Includes user profile picture
  - [ ] Handles missing data gracefully

- [ ] **Full Notification**
  - [ ] Sends detailed policy information
  - [ ] All fields included correctly
  - [ ] Error handling for failed sends

## Edge Cases and Error Handling

### 1. Data Validation
- [ ] **Invalid Dates**
  - [ ] Future dates where inappropriate
  - [ ] Invalid date formats
  - [ ] Null/undefined dates

- [ ] **Invalid Numbers**
  - [ ] Negative commission rates
  - [ ] Zero or negative premiums
  - [ ] Non-numeric input in number fields
  - [ ] Very large numbers

- [ ] **String Validation**
  - [ ] Empty strings in required fields
  - [ ] Very long strings
  - [ ] Special characters and emojis
  - [ ] SQL injection attempts

### 2. Database Edge Cases
- [ ] **Connection Issues**
  - [ ] Network timeout handling
  - [ ] Database connection loss
  - [ ] Retry mechanisms

- [ ] **Data Integrity**
  - [ ] Duplicate policy numbers
  - [ ] Orphaned records
  - [ ] Missing foreign key references

### 3. User Interface Edge Cases
- [ ] **Responsive Design**
  - [ ] Mobile device compatibility
  - [ ] Very small screen sizes
  - [ ] Very large screen sizes

- [ ] **Browser Compatibility**
  - [ ] Different browsers (Chrome, Firefox, Safari)
  - [ ] JavaScript disabled
  - [ ] Slow internet connections

### 4. Authentication Edge Cases
- [ ] **Session Management**
  - [ ] Session expiration handling
  - [ ] Invalid tokens
  - [ ] Concurrent sessions

- [ ] **Authorization**
  - [ ] Access to other users' data
  - [ ] API endpoint security
  - [ ] CSRF protection

## Performance Tests

### 1. Large Data Sets
- [ ] **Many Policies**
  - [ ] 100+ policies performance
  - [ ] 1000+ policies handling
  - [ ] Pagination needs

- [ ] **Complex Filters**
  - [ ] Multiple filters applied simultaneously
  - [ ] Search with large result sets
  - [ ] Chart rendering with large datasets

### 2. API Performance
- [ ] **Response Times**
  - [ ] Policy CRUD operations
  - [ ] Filter and search operations
  - [ ] Dashboard data loading

## Security Tests

### 1. Input Validation
- [ ] **XSS Prevention**
  - [ ] Script injection in text fields
  - [ ] HTML injection
  - [ ] Event handler injection

- [ ] **SQL Injection**
  - [ ] Malicious input in search
  - [ ] Special characters in form fields

### 2. API Security
- [ ] **Authentication Required**
  - [ ] All API endpoints require auth
  - [ ] Invalid tokens rejected
  - [ ] User isolation enforced

## Browser Console Tests
- [ ] No JavaScript errors on page load
- [ ] No errors during normal operations
- [ ] Warnings are minimal and acceptable
- [ ] Network requests complete successfully

## Testing Notes
- Test with both empty and populated data states
- Test rapid user interactions (double-clicks, fast typing)
- Test browser back/forward buttons
- Test page refresh during operations
- Test with different user accounts
- Test with different time zones 