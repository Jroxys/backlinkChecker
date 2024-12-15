import os.path
import requests
import re
from bs4 import BeautifulSoup
#GET LINKS ----> CHECK IF THEY ARE VALID -----> CHECK IF CONTENT IS EXIST -----> IF DELETED SEND EMAIL ------>
#First check if file exists.
fileDirectory = "backlink-checker/links.txt"
fileDirectoryBacklink = "backlink-checker/backlinks.txt"
fileObject = open(fileDirectory,"r+",encoding="utf-8")
fileObjectBacklink = open(fileDirectoryBacklink,"r+",encoding="utf-8")

linkList = [] #Links from txt file.
deletedLinks = [] #Backlinks which is not working
ourLinks = [] #backlink links
deletedBacklinks = []

checkEmpty = os.path.getsize(fileDirectory) == 0
checkEmptyBacklink = os.path.getsize(fileDirectoryBacklink) == 0

def getLinks():
    if checkEmpty:
        print("File is empty please add some links.")
    else:
        for files in fileObject:
            linkList.append(files.strip())
    if checkEmptyBacklink:
        print("File is empty please add your backlinks.")
    else:
        for file in fileObjectBacklink:
            ourLinks.append(file.strip())
        

def checkLinks():
    #Checks for valid links.
    for link in linkList[:]:       
        try:
            response = requests.get(link,timeout=10,allow_redirects=True)
            responseCode = response.status_code
            if responseCode == 200:
                print("Website is existing.Checking for content.")
                #Web site exists. Check content.
                try:
                    #Parse the content
                    bsObj = BeautifulSoup(response.content.decode(response.encoding, errors='ignore'), 'html.parser')
                    #Check for noindex meta tag
                    if not bsObj.findAll('meta', content=re.compile("noindex")):  
                        #Check for specific links
                        backlinks_found = []
                        for pattern in ourLinks:
                            if bsObj.find('a', href=re.compile(pattern)):
                                backlinks_found.append(pattern)
                    
                        if backlinks_found:
                            print(f"Backlinks found on {link}: {', '.join(backlinks_found)}")
                        else:
                            print(f"No backlinks found on {link}.")
                            deletedBacklinks.append(link)
                                    
                    else:
                        print(f"Noindex found on {link}. Status Code: {responseCode}")
                except Exception as parse_error:
                    print(f"Error processing content for {link}: {parse_error}")
            else:
                print(f"Website {link} does not exist. Status Code: {responseCode}")
        except requests.exceptions.Timeout:
            print(f"Request timed out for {link}. Removing from list.")
            deletedLinks.append(link)
            linkList.pop(link)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {link}: {e}")
            deletedLinks.append(link)
            linkList.pop(link)
            try:
                deletedLinks.append(link)
                linkList.remove(link)
            except IndexError:
                print('You dont have any valid links.')                 
getLinks()
if linkList and ourLinks:
    checkLinks()
else:
    print("No valid links or backlink patterns to check.")

#Summary
print("\nSummary:")
print(f"Valid Links Checked: {len(linkList)}")
print(f"Deleted Backlinks: {deletedBacklinks}")
print(f"Not Working Links: {len(deletedLinks)} - {deletedLinks}")
