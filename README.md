# Schulnetz 2.0

A comprehensive web application for Swiss apprentice students to calculate, visualize, and analyze their grades in professional vocational education (Berufsmaturität and Berufsschule/EFZ). It's actully developped for information scientists with BM 1.

## Features

### 📚 Berufsmaturität (BM)
- **Grade Tracking**: Manage grades from all BM subjects organized by semester
- **Grade Simulation**: Plan future grades with what-if scenarios
- **Semester Analysis**: View promotion status and overall performance
- **Final Exam Planning**: Calculate required exam grades to achieve target marks
- **Automatic Rounding**: Grades are intelligently rounded to the nearest half-point

### 👾 Berufsschule (EFZ)
- **Module Management**: Organize and track vocational training modules by semester
- **Module Simulation**: Plan module grades with planned controls
- **üK Grades**: Track practical training course results
- **IPA Tracking**: Record final project (IPA) grades
- **Automatic Calculations**: Compute school part (80% modules + 20% üK) and final grades
- **Document Scanning**: Upload and analyze report cards and SAL screenshots using AI

### 🎯 User Features
- **Secure Authentication**: User registration and login via Supabase
- **Data Persistence**: All data synchronized with Supabase PostgreSQL database
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with Tailwind CSS styling
- **Automatic Sync**: Status indicator showing database synchronization state

## Technology Stack

- **Frontend**: React 18 + Vite
- **UI Framework**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend**: Node.js (optional for AI features)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Document Analysis**: Anthropic Claude API
- **Version Control**: Git

## Project Structure

```
schulnetz2.0/
├── src/
│   ├── components/          # React components
│   │   ├── GradeCard.jsx    # Grade input component
│   │   ├── SemesterSimulatorCard.jsx
│   │   ├── PromotionStatus.jsx
│   │   ├── BulletinAnalysis.jsx
│   │   ├── AuthPanel.jsx
│   │   └── AccountSettings.jsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.js      # Authentication hook
│   │   ├── useDatabase.js  # Database operations
│   │   ├── useGradeCalculations.js
│   │   └── useApprenticeshipCalculations.js
│   ├── services/           # Business logic
│   │   ├── supabaseClient.js
│   │   ├── calculationService.js
│   │   ├── efzService.js
│   │   ├── apiService.js   # Claude API integration
│   │   └── semesterGradeService.js
│   ├── utils/              # Utility functions
│   ├── constants/          # Data constants (subjects, etc.)
│   ├── styles/             # CSS files
│   ├── App.jsx             # Main application component
│   └── main.jsx            # Entry point
├── supabase/               # Database migrations
│   └── migrations/
├── index.html
├── config.js               # Configuration file
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## Installation

### Prerequisites
- Node.js >= 20
- npm or yarn
- Supabase account

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd schulnetz2.0
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

## Usage

### Getting Started
1. Register a new account or sign in
2. Select your BM type (TAL, EM, ID, MS) in settings
3. Set your current semester
4. Start adding grades and modules

### Adding Grades
- **Manual Entry**: Click on a subject to add individual control grades
- **Batch Import**: Upload report card images for automatic grade extraction
- **SAL Scanner**: Upload SAL screenshots to import module grades automatically

### Simulations
- **BM Simulation**: Add planned controls to see projected semester averages
- **Module Simulation**: Plan module grades and see impact on final marks
- **Exam Planning**: Calculate required exam scores to reach your goals

### Settings
- Manage user profile and password
- Change BM type and current semester
- View synchronization status
- Logout securely

## Database Schema

### Main Tables
- `users` - User profiles and preferences
- `grades` - Individual control grades (BM)
- `semester_grades` - Semester-level averages (BM)
- `semester_plans` - Planned controls for simulation
- `subject_goals` - Target grades by subject
- `exam_grades` - Final exam marks

### EFZ Tables
- `efz_modules` - Vocational training modules
- `efz_module_grades` - Individual module control grades
- `efz_uek_grades` - Practical training course grades
- `efz_ipa` - Final project grades

## Calculation Logic

### BM Grade Calculation
- **Weighted Average**: Controls are weighted according to instructor specifications
- **Rounding**: Rounded to nearest 0.5 points
- **Semester Average**: Arithmetic mean of weighted averages, rounded to 0.5
- **Experience Grade** (Erfahrungsnote): Average of all semester grades, rounded to 0.5
- **Final Mark**: Average of experience grade and exam mark (no further rounding)

### EFZ Grade Calculation
- **Module Average**: Weighted average of module controls, rounded to 0.5
- **Modules Average**: Arithmetic mean of module averages, rounded to 0.5
- **üK Average**: Mean of üK grades, rounded to 0.5
- **School Part**: 80% module average + 20% üK average, rounded to 0.1
- **Final Grade**: 50% school part + 50% IPA grade, rounded to 0.1

## API Integration

### Claude API for Document Analysis
The application uses Anthropic's Claude API to extract grades from:
- **Report Cards** (Zeugnisse): Extract module averages and semester information
- **SAL Screenshots**: Extract control grades with dates and module assignments

Extracted data is automatically validated and stored in the database.

## Development

### npm Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style
- Uses ESLint for code quality
- Follows React best practices
- Tailwind CSS for styling

## Deployment

### Frontend
The frontend can be deployed to:
- Vercel
- Netlify
- Any static hosting service

### Database
Supabase hosting is included in the project configuration.

## Security

- **Authentication**: All requests require Supabase authentication
- **Row Level Security (RLS)**: Database policies enforce user isolation
- **API Keys**: Use only anonymous/publishable keys in frontend
- **Environment Variables**: Sensitive data stored in `.env` files
- **CORS**: Configured to accept requests from authorized origins

## Performance

- **Client-Side Calculations**: Most calculations done locally for instant feedback
- **Database Indexing**: Optimized queries for fast data retrieval
- **Lazy Loading**: Components load on demand
- **Caching**: User data cached to minimize database requests

## Troubleshooting

### Common Issues

**Database Not Syncing**
- Check your internet connection
- Verify Supabase credentials in `.env`
- Check database status in Supabase dashboard

**Grades Not Appearing**
- Ensure you're on the correct semester
- Verify grades are saved by checking sync status
- Reload the page to refresh data

**AI Document Scanning Not Working**
- Verify Claude API key is configured in backend
- Check image file format and size
- Review API usage limits

## Contributing

1. Create a feature branch
2. Commit changes
3. Push to branch
4. Open a Pull Request

## License

This project is proprietary and intended for educational use only.

## Support

For issues, questions, or suggestions:
- Create an issue in the repository
- Contact the development team

## Changelog

### Version 2.0
- Complete redesign with Supabase integration
- Added EFZ/Berufsschule module support
- Implemented AI-powered document scanning
- Improved semester-based organization
- Modern responsive UI

### Version 1.0
- Initial release
- Basic grade tracking for BM
- Simple grade calculations

---

**Schulnetz 2.0** - Making vocational education grade tracking simple and effective.

Last updated: May 2026
