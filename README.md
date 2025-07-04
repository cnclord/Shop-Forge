# Shop Master - Machine Shop Management System

A comprehensive application for managing machine shop logistics, including PO processing, part inventory, job scheduling, and production tracking.

## Features (Planned)

1. **PO Upload and Processing** - Upload and scan purchase orders to extract relevant information and add jobs to the system
2. **Part Information Database** - Store and manage information about parts, including cycle times, tool lists, plating requirements, setup sheets, revisions, and production quantities
3. **Job Scheduling** - Generate efficient job schedules based on due dates, part information, and machine availability
4. **Inventory Management** - Track part inventory throughout the production process and get notifications for low stock levels

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Real-Time Updates**: Socket.IO
- **Deployment**: Vercel or Render

## Project Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd shop-master
   ```

2. Install the dependencies
   ```
   npm install
   cd client
   npm install
   cd ..
   ```

3. Create a PostgreSQL database

4. Configure the environment variables
   - Rename `.env.example` to `.env`
   - Update the database credentials

5. Start the development server
   ```
   npm run dev
   ```

## Current Status

This project is being developed in stages. The current focus is on implementing the PO upload and scanning functionality.

## Development Roadmap

1. **Phase 1** (Current): PO Upload and Processing
   - Upload PDF purchase orders
   - Extract information like PO number, customer, date, and line items
   - Store in database

2. **Phase 2**: Part Information Database
   - Create forms for manual data entry
   - Store part-specific information

3. **Phase 3**: Job Scheduling
   - Implement scheduling algorithms
   - Generate production schedules

4. **Phase 4**: Inventory Management
   - Track parts through production stages
   - Generate notifications for low stock

## Contributing

This is a personal learning project. Contributions and suggestions are welcome.

## License

MIT #   S H O P - M A S T E R  
 #   S H O P - M A S T E R  
 