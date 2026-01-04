# 4-in-a-Row Game

Welcome to the **4-in-a-Row** game! This is a classic 2-player game (also known as Connect Four) implemented in JavaScript/Node.js. Players take turns dropping discs into a 7x6 grid, aiming to be the first to connect four discs in a row, either horizontally, vertically, or diagonally.

- **Play Game**: https://4-in-a-row-eosin.vercel.app/

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Setup and Running the Application](#setup-and-running-the-application)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Multiplayer**: Two players can play a game if they join within 10s otherwise is assigned to play.
- **Grid Setup**: A 7x6 grid for playing.
- **Win Check**: Automatically detects if a player has won by connecting 4 discs.
- **UI**: Simple and intuitive user interface to interact with the game.

---

## Installation

To set up and run this project locally, follow the steps below.

### Prerequisites

Before starting, make sure you have the following installed on your machine:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/) (Node package manager)

### Steps to Install

1. **Clone the Repository**

   Open your terminal and run the following command to clone the project:

   ```bash
   git clone https://github.com/Mitali-A13/4-in-a-row.git
   ```

2. **Navigate to the Project Directory**

   Change into the project directory:

   ```bash
   cd 4-in-a-row
   ```

3. **Install Dependencies**

   If you're using Node.js (or a similar package manager), install the necessary dependencies:

   ```bash
   npm install
   ```

   This will install all required libraries and dependencies listed in the `package.json` file.

---

## Setup and Running the Application

### Running the App Locally

1. **Start the Application**

   After the dependencies have been installed, run the application using:

   ```bash
   npm start
   ```

   This will start the local server and open the game in your default web browser (usually at `http://localhost:3000`).

2. **Open in Browser**

   If the app does not open automatically, you can manually open your browser and go to:

   ```
   http://localhost:3000
   ```

   The game should now be running, and you can start playing!

---

## Usage

### Game Instructions

1. The game board consists of a 7x6 grid.
2. Players take turns clicking on a column to drop their disc into the lowest available space in that column.
3. The first player to connect four discs in a row, either horizontally, vertically, or diagonally, wins the game.
4. Once the game ends, you can restart by clicking the play again button.

### Game Controls

- **Click on a column**: Drop your disc in the column.
- **Restart**: Click the "Play Again" button to start a new game after a winner is declared.

---

## Contributing

If you would like to contribute to this project, feel free to fork the repository and submit a pull request with your changes.

### Steps to Contribute

1. Fork the repository on GitHub.
2. Clone your forked repository to your local machine.
3. Make your changes or improvements.
4. Commit your changes and push them to your fork.
5. Open a pull request to the original repository with a detailed explanation of the changes.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Enjoy the game and thanks for checking out this project!** 😄
